-- Roll call class roster: QR-built persistent list per recurring class series.
--
-- Product:
--   - First open of a class series → empty list (NOT Mindbody bookings)
--   - Coach scans member QR → confirm Present → member saved on this class list
--   - Later sessions of the same series reuse the list for quick present/absent
--   - Coach can manually delete a member; no automatic removal
--
-- list_key scopes the series (title + staff + weekday + local time in Asia/Dubai)
-- so Tuesday 17:00 BJJ next week shares the same roster as this week.
-- Session marks remain on classes.id (occurrence occurrence) as today.

create table if not exists public.roll_call_class_roster (
  id uuid primary key default gen_random_uuid(),
  list_key text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete restrict,
  added_at timestamptz not null default now(),
  display_name_snapshot text,
  avatar_url_snapshot text,
  constraint roll_call_class_roster_list_user unique (list_key, user_id)
);

create index if not exists roll_call_class_roster_list_key_idx
  on public.roll_call_class_roster (list_key, added_at desc);

comment on table public.roll_call_class_roster is
  'Persistent coach roll-call list for a recurring class series. Grown by QR scan; removed only manually.';

alter table public.roll_call_class_roster enable row level security;

drop policy if exists "roll_call_class_roster coach read" on public.roll_call_class_roster;
create policy "roll_call_class_roster coach read"
  on public.roll_call_class_roster
  for select to authenticated
  using (public.is_coach_or_admin());

-- Writes go through security-definer RPCs only.
revoke all on table public.roll_call_class_roster from public, anon, authenticated;
grant select on table public.roll_call_class_roster to authenticated;
grant all on table public.roll_call_class_roster to service_role;

create or replace function public.roll_call_list_key_for_class(p_class_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_title text;
  v_staff text;
  v_starts timestamptz;
  v_local timestamp;
  v_dow int;
  v_hm text;
begin
  select c.title, c.staff_mindbody_id, c.starts_at
    into v_title, v_staff, v_starts
  from public.classes c
  where c.id = p_class_id;

  if v_starts is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_local := timezone('Asia/Dubai', v_starts);
  v_dow := extract(dow from v_local)::int;
  v_hm := to_char(v_local, 'HH24:MI');

  return md5(
    lower(trim(coalesce(v_title, ''))) || '|' ||
    coalesce(nullif(trim(v_staff), ''), '_') || '|' ||
    v_dow::text || '|' ||
    v_hm
  );
end;
$$;

revoke all on function public.roll_call_list_key_for_class(uuid) from public, anon;
grant execute on function public.roll_call_list_key_for_class(uuid) to authenticated, service_role;

create or replace function public.get_roll_call_member_preview(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_linked boolean;
  v_mb text;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_QR', 'message', 'This is not a valid 971 MMA member code.');
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'UNKNOWN_MEMBER',
      'message', 'We could not find this member in the academy app.'
    );
  end if;

  select ml.mindbody_client_id
    into v_mb
  from public.mindbody_links ml
  where ml.user_id = p_user_id
  limit 1;

  v_linked := v_mb is not null;

  if not v_linked then
    return jsonb_build_object(
      'ok', false,
      'code', 'NOT_LINKED',
      'message', 'This member has an app account but is not linked to Mindbody yet.',
      'member', jsonb_build_object(
        'userId', v_profile.id,
        'fullName', coalesce(nullif(trim(v_profile.full_name), ''), 'Member'),
        'avatarUrl', v_profile.avatar_url,
        'membershipStatus', coalesce(v_profile.membership_status, 'unknown'),
        'membershipActive', false,
        'isLinked', false
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'member', jsonb_build_object(
      'userId', v_profile.id,
      'fullName', coalesce(nullif(trim(v_profile.full_name), ''), 'Member'),
      'avatarUrl', v_profile.avatar_url,
      'membershipStatus', coalesce(v_profile.membership_status, 'unknown'),
      'membershipActive', lower(coalesce(v_profile.membership_status, '')) in ('active', 'current'),
      'isLinked', true,
      'mindbodyClientId', v_mb,
      'beltRank', v_profile.belt_rank,
      'beltStripes', coalesce(v_profile.belt_stripes, 0)
    )
  );
end;
$$;

revoke all on function public.get_roll_call_member_preview(uuid) from public, anon;
grant execute on function public.get_roll_call_member_preview(uuid) to authenticated;

create or replace function public.add_roll_call_class_member(
  p_class_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_key text;
  v_profile public.profiles%rowtype;
  v_row public.roll_call_class_roster%rowtype;
begin
  perform public.require_roll_call_coach_for_class(p_class_id);

  if p_user_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  v_list_key := public.roll_call_list_key_for_class(p_class_id);

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  insert into public.roll_call_class_roster as r (
    list_key, user_id, added_by, display_name_snapshot, avatar_url_snapshot
  )
  values (
    v_list_key,
    p_user_id,
    auth.uid(),
    coalesce(nullif(trim(v_profile.full_name), ''), 'Member'),
    v_profile.avatar_url
  )
  on conflict (list_key, user_id) do update
    set display_name_snapshot = excluded.display_name_snapshot,
        avatar_url_snapshot = excluded.avatar_url_snapshot
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'listKey', v_list_key,
    'userId', v_row.user_id,
    'displayName', v_row.display_name_snapshot,
    'avatarUrl', v_row.avatar_url_snapshot,
    'addedAt', v_row.added_at
  );
end;
$$;

revoke all on function public.add_roll_call_class_member(uuid, uuid) from public, anon;
grant execute on function public.add_roll_call_class_member(uuid, uuid) to authenticated;

create or replace function public.remove_roll_call_class_member(
  p_class_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_key text;
  v_deleted int;
begin
  perform public.require_roll_call_coach_for_class(p_class_id);

  if p_user_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  v_list_key := public.roll_call_list_key_for_class(p_class_id);

  delete from public.roll_call_class_roster
  where list_key = v_list_key
    and user_id = p_user_id;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'removed', v_deleted > 0,
    'listKey', v_list_key,
    'userId', p_user_id
  );
end;
$$;

revoke all on function public.remove_roll_call_class_member(uuid, uuid) from public, anon;
grant execute on function public.remove_roll_call_class_member(uuid, uuid) to authenticated;

create or replace function public.list_roll_call_class_members(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_key text;
begin
  perform public.require_roll_call_coach_for_class(p_class_id);
  v_list_key := public.roll_call_list_key_for_class(p_class_id);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'userId', r.user_id,
          'displayName', coalesce(
            nullif(trim(p.full_name), ''),
            r.display_name_snapshot,
            'Member'
          ),
          'avatarUrl', coalesce(p.avatar_url, r.avatar_url_snapshot),
          'membershipStatus', coalesce(p.membership_status, 'unknown'),
          'membershipActive', lower(coalesce(p.membership_status, '')) in ('active', 'current'),
          'beltRank', p.belt_rank,
          'beltStripes', coalesce(p.belt_stripes, 0),
          'mindbodyClientId', ml.mindbody_client_id,
          'isOnApp', true,
          'addedAt', r.added_at
        )
        order by lower(coalesce(nullif(trim(p.full_name), ''), r.display_name_snapshot, 'member'))
      )
      from public.roll_call_class_roster r
      left join public.profiles p on p.id = r.user_id
      left join public.mindbody_links ml on ml.user_id = r.user_id
      where r.list_key = v_list_key
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.list_roll_call_class_members(uuid) from public, anon;
grant execute on function public.list_roll_call_class_members(uuid) to authenticated;

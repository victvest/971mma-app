-- Community membership sync: explicit product mappings only, revoke stale access.

create or replace function public.community_eligible_channel_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- 1) Active discipline entitlements.
  select distinct ch.id
  from public.community_channels ch
  join public.member_disciplines md
    on md.discipline_id = ch.discipline_id
   and md.user_id = p_user
   and md.active = true
  where ch.status = 'active'
    and ch.deleted_at is null

  union

  -- 2) Verified class attendance.
  select distinct ch.id
  from public.check_ins ci
  join public.classes c on c.id = ci.class_id
  join public.community_channels ch
    on ch.discipline_id = c.discipline_id
   and ch.status = 'active'
   and ch.deleted_at is null
  where ci.user_id = p_user
    and ci.signed_in = true
    and coalesce(ci.missed, false) = false
    and coalesce(ci.late_cancelled, false) = false
    and c.discipline_id is not null

  union

  -- 3) Coach-owned groups (linked coach profile only — no name matching).
  select distinct ch.id
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  where ch.status = 'active'
    and ch.deleted_at is null
    and co.active = true
    and co.deleted_at is null
    and co.user_id = p_user

  union

  -- 4) Admin-configured membership product → discipline mappings (explicit only).
  select distinct ch.id
  from public.member_memberships mm
  join public.membership_product_disciplines mpd
    on mpd.active = true
   and (
     (mpd.match_type = 'mindbody_id' and mm.mindbody_record_id = mpd.match_value)
     or (mpd.match_type = 'name_exact' and lower(trim(mm.name)) = lower(trim(mpd.match_value)))
     or (mpd.match_type = 'name_contains' and mm.name ilike '%' || mpd.match_value || '%')
   )
  join public.community_channels ch
    on ch.discipline_id = mpd.discipline_id
   and ch.status = 'active'
   and ch.deleted_at is null
  where mm.user_id = p_user
    and mm.status in ('active', 'Active', 'current', 'Current');
$$;

create or replace function public.sync_community_memberships(p_user uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_granted int := 0;
  v_revoked int := 0;
begin
  if v_user is null then
    return 0;
  end if;

  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct eligible.channel_id, v_user, now()
  from (
    select community_eligible_channel_ids as channel_id
    from public.community_eligible_channel_ids(v_user)
  ) eligible
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  get diagnostics v_granted = row_count;

  update public.community_memberships cm
  set joined_at = null,
      updated_at = now()
  where cm.user_id = v_user
    and cm.joined_at is not null
    and cm.channel_id not in (
      select community_eligible_channel_ids
      from public.community_eligible_channel_ids(v_user)
    );

  get diagnostics v_revoked = row_count;

  return v_granted + v_revoked;
end;
$$;

revoke execute on function public.community_eligible_channel_ids(uuid) from public, anon;
grant execute on function public.community_eligible_channel_ids(uuid) to authenticated, service_role;

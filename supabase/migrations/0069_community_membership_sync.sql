-- Fix community visibility: sync memberships from attendance + coach ownership + disciplines.
-- Backfill existing members so groups appear without manual admin enrollment.

create or replace function public.sync_community_memberships(p_user uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_count int := 0;
begin
  if v_user is null then
    return 0;
  end if;

  -- 1) Discipline entitlements from member_disciplines.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.community_channels ch
  join public.member_disciplines md
    on md.discipline_id = ch.discipline_id
   and md.user_id = v_user
   and md.active = true
  where ch.status = 'active'
    and ch.deleted_at is null
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  get diagnostics v_count = row_count;

  -- 2) Class attendance — members who checked in inherit that class discipline.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.check_ins ci
  join public.classes c on c.id = ci.class_id
  join public.community_channels ch
    on ch.discipline_id = c.discipline_id
   and ch.status = 'active'
   and ch.deleted_at is null
  where ci.user_id = v_user
    and ci.signed_in = true
    and coalesce(ci.missed, false) = false
    and coalesce(ci.late_cancelled, false) = false
    and c.discipline_id is not null
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  -- 3) Coach-owned groups — coaches always see their discipline channels.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  where ch.status = 'active'
    and ch.deleted_at is null
    and co.active = true
    and co.deleted_at is null
    and (
      co.user_id = v_user
      or exists (
        select 1
        from public.profiles pr
        where pr.id = v_user
          and pr.full_name is not null
          and lower(trim(pr.full_name)) = lower(trim(co.name))
      )
    )
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  -- 4) Active membership mirror — infer discipline from Mindbody plan names.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.member_memberships mm
  join public.community_channels ch on ch.status = 'active' and ch.deleted_at is null
  join public.disciplines d on d.id = ch.discipline_id and d.active = true
  where mm.user_id = v_user
    and mm.status in ('active', 'Active', 'current', 'Current')
    and (
      (d.slug = 'bjj' and (mm.name ilike '%jiu%' or mm.name ilike '%bjj%'))
      or (d.slug = 'wrestling' and mm.name ilike '%wrest%')
      or (d.slug = 'muay_thai' and (mm.name ilike '%muay%' or mm.name ilike '%thai%' or mm.name ilike '%strik%'))
      or (d.slug = 'mma' and (mm.name ilike '%mma%' or mm.name ilike '%mixed%'))
      or (d.slug = 'boxing' and mm.name ilike '%box%')
      or (d.slug = 'personal_training' and (mm.name ilike '%personal%' or mm.name ilike '%pt%'))
      or (d.slug = 'yoga_mobility' and (mm.name ilike '%yoga%' or mm.name ilike '%mobil%'))
      or (d.slug = 'performance_fitness' and (
        mm.name ilike '%fit%'
        or mm.name ilike '%strength%'
        or mm.name ilike '%cond%'
        or mm.name ilike '%performance%'
        or mm.name ilike '%unlimited%'
        or mm.name ilike '%membership%'
      ))
    )
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  return v_count;
end;
$$;

-- Ensure every coach with discipline assignments has a channel row.
insert into public.community_channels (coach_id, discipline_id, title, description, status)
select
  cd.coach_id,
  cd.discipline_id,
  co.name || ' · ' || d.display_name,
  'Coach updates and discussion for ' || d.display_name || ' members.',
  'active'
from public.coach_disciplines cd
join public.coaches co on co.id = cd.coach_id
join public.disciplines d on d.id = cd.discipline_id
where co.active = true
  and co.deleted_at is null
on conflict (coach_id, discipline_id) do update
set title = excluded.title,
    description = excluded.description,
    updated_at = now(),
    status = case when public.community_channels.status = 'archived' then 'active' else public.community_channels.status end;

-- Backfill memberships for all existing users from attendance + coach ownership.
do $$
declare
  v_user uuid;
begin
  for v_user in select id from public.profiles loop
    perform public.sync_community_memberships(v_user);
  end loop;
end;
$$;

create or replace function public.list_coach_community_channels(p_coach_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_channels jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  insert into public.community_channels (coach_id, discipline_id, title, description, status)
  select
    cd.coach_id,
    cd.discipline_id,
    co.name || ' · ' || d.display_name,
    'Coach updates and discussion for ' || d.display_name || ' members.',
    'active'
  from public.coach_disciplines cd
  join public.coaches co on co.id = cd.coach_id
  join public.disciplines d on d.id = cd.discipline_id
  where cd.coach_id = v_coach_id
  on conflict (coach_id, discipline_id) do nothing;

  perform public.sync_community_memberships(v_user);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ch.id,
        'title', ch.title,
        'description', ch.description,
        'disciplineName', d.display_name,
        'disciplineSlug', d.slug,
        'coachName', co.name,
        'coachAvatarUrl', p.avatar_url,
        'latestPostAt', latest.published_at,
        'lastMessageAt', latest.published_at,
        'lastMessagePreview', latest.preview,
        'unreadCount', coalesce(unread.cnt, 0),
        'memberCount', member_counts.cnt,
        'isCoachOwner', true
      )
      order by coalesce(latest.published_at, ch.created_at) desc, d.sort_order asc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join public.profiles p on p.id = co.user_id
  join public.coach_disciplines cd on cd.coach_id = ch.coach_id and cd.discipline_id = ch.discipline_id
  left join public.community_memberships cm
    on cm.channel_id = ch.id
   and cm.user_id = v_user
   and cm.joined_at is not null
  left join lateral (
    select
      cp.published_at,
      left(coalesce(nullif(trim(cp.title), ''), cp.body), 120) as preview
    from public.community_posts cp
    where cp.channel_id = ch.id
      and cp.status = 'published'
      and cp.deleted_at is null
    order by cp.published_at desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_posts cp_unread
    where cp_unread.channel_id = ch.id
      and cp_unread.status = 'published'
      and cp_unread.deleted_at is null
      and cp_unread.published_at > coalesce(cm.last_read_at, cm.joined_at, '-infinity'::timestamptz)
  ) unread on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_memberships cm2
    where cm2.channel_id = ch.id
      and cm2.joined_at is not null
  ) member_counts on true
  where ch.coach_id = v_coach_id
    and ch.deleted_at is null;

  return jsonb_build_object('channels', v_channels);
end;
$$;

grant execute on function public.sync_community_memberships(uuid) to authenticated;
grant execute on function public.list_coach_community_channels(uuid) to authenticated;

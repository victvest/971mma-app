-- Fix announcement notification fan-out: include all profiles (including the author).
-- Coaches who switch to member mode on the same account must see their posts.

create or replace function public.create_announcement(
  p_channel text,
  p_title text,
  p_body text
)
returns public.announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel text := nullif(trim(p_channel), '');
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(p_body), '');
  v_row public.announcements%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_title is null or v_body is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.announcements (author_id, channel, title, body)
  values (auth.uid(), coalesce(v_channel, 'general'), v_title, v_body)
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select
    p.id,
    'announcement',
    jsonb_build_object(
      'announcementId', v_row.id,
      'channel', v_row.channel,
      'title', v_row.title,
      'body', v_row.body
    )
  from public.profiles p;

  return v_row;
end;
$$;

-- Backfill notifications for announcements that skipped the author (or any profile).
insert into public.notifications (user_id, type, payload)
select
  p.id,
  'announcement',
  jsonb_build_object(
    'announcementId', a.id,
    'channel', a.channel,
    'title', a.title,
    'body', a.body
  )
from public.announcements a
cross join public.profiles p
where not exists (
  select 1
  from public.notifications n
  where n.user_id = p.id
    and n.type = 'announcement'
    and n.payload->>'announcementId' = a.id::text
);

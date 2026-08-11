-- Coach announcements targeted to roll-call swipe-list (class roster) members.
-- General = union of roster members across the coach's today+tomorrow classes.
-- Classes = union of roster members for the selected class ids only.

create or replace function public.coach_announcement_class_window()
returns table (
  class_id uuid,
  title text,
  discipline text,
  starts_at timestamptz,
  list_key text,
  roster_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.coach_id_for_user(auth.uid());
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_tomorrow date := v_today + 1;
  v_range_start timestamptz := (v_today::text || ' 00:00:00+04')::timestamptz;
  v_range_end timestamptz := (v_tomorrow::text || ' 23:59:59.999+04')::timestamptz;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_coach_id is null and not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return query
  select
    c.id as class_id,
    c.title,
    coalesce(d.display_name, c.discipline, 'Class') as discipline,
    c.starts_at,
    public.roll_call_list_key_for_class(c.id) as list_key,
    (
      select count(*)::int
      from public.roll_call_class_roster r
      where r.list_key = public.roll_call_list_key_for_class(c.id)
    ) as roster_count
  from public.classes c
  left join public.disciplines d on d.id = c.discipline_id
  where c.mindbody_class_id is not null
    and c.is_cancelled = false
    and c.starts_at >= v_range_start
    and c.starts_at <= v_range_end
    and (
      v_coach_id is null
      or (
        public.coach_teaches_class(v_coach_id, c)
        and public.coach_has_discipline_access(v_coach_id, c.discipline_id)
      )
    )
  order by c.starts_at asc;
end;
$$;

revoke all on function public.coach_announcement_class_window() from public, anon;
grant execute on function public.coach_announcement_class_window() to authenticated;

create or replace function public.list_coach_announcement_targets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_classes jsonb := '[]'::jsonb;
  v_general_count integer := 0;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', row.class_id,
        'title', row.title,
        'discipline', row.discipline,
        'startsAt', row.starts_at,
        'rosterCount', row.roster_count
      )
      order by row.starts_at asc
    ),
    '[]'::jsonb
  )
    into v_classes
  from public.coach_announcement_class_window() as row;

  select count(distinct r.user_id)::int
    into v_general_count
  from public.roll_call_class_roster r
  where r.list_key in (
    select w.list_key from public.coach_announcement_class_window() w
  );

  return jsonb_build_object(
    'classes', v_classes,
    'generalRecipientCount', coalesce(v_general_count, 0)
  );
end;
$$;

revoke all on function public.list_coach_announcement_targets() from public, anon;
grant execute on function public.list_coach_announcement_targets() to authenticated;

create or replace function public.coach_send_announcement(
  p_title text,
  p_body text,
  p_mode text default 'general',
  p_class_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(p_body), '');
  v_mode text := lower(coalesce(nullif(trim(p_mode), ''), 'general'));
  v_row public.announcements%rowtype;
  v_channel text;
  v_list_keys text[] := '{}';
  v_recipients integer := 0;
  v_class_id uuid;
  v_allowed boolean;
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

  if v_mode not in ('general', 'classes') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_mode = 'classes' then
    if p_class_ids is null or coalesce(cardinality(p_class_ids), 0) = 0 then
      raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
    end if;

    foreach v_class_id in array p_class_ids loop
      select exists (
        select 1
        from public.coach_announcement_class_window() w
        where w.class_id = v_class_id
      )
        into v_allowed;

      if not coalesce(v_allowed, false) then
        raise exception using message = 'FORBIDDEN', errcode = 'P0001';
      end if;

      v_list_keys := array_append(v_list_keys, public.roll_call_list_key_for_class(v_class_id));
    end loop;

    v_channel := 'classes';
  else
    select coalesce(array_agg(distinct w.list_key), '{}')
      into v_list_keys
    from public.coach_announcement_class_window() w;

    v_channel := 'general';
  end if;

  insert into public.announcements (author_id, channel, title, body)
  values (auth.uid(), v_channel, v_title, v_body)
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select distinct
    r.user_id,
    'announcement',
    jsonb_build_object(
      'announcementId', v_row.id,
      'channel', v_row.channel,
      'title', v_row.title,
      'body', v_row.body,
      'mode', v_mode,
      'classIds', coalesce(to_jsonb(p_class_ids), '[]'::jsonb)
    )
  from public.roll_call_class_roster r
  where r.list_key = any (v_list_keys)
    and coalesce(public.notification_enabled(r.user_id, 'announcement'), true);

  get diagnostics v_recipients = row_count;

  return jsonb_build_object(
    'announcementId', v_row.id,
    'channel', v_row.channel,
    'title', v_row.title,
    'body', v_row.body,
    'mode', v_mode,
    'recipientCount', coalesce(v_recipients, 0),
    'createdAt', v_row.created_at
  );
end;
$$;

revoke all on function public.coach_send_announcement(text, text, text, uuid[]) from public, anon;
grant execute on function public.coach_send_announcement(text, text, text, uuid[]) to authenticated;

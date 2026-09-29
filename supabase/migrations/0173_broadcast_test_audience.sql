-- 0173_broadcast_test_audience.sql
-- Add test_mlbegueroumi audience option to admin_send_broadcast RPC
-- Restricted so only the super admin (bahaaeddinegueroumi@gmail.com) can target this test audience.

create or replace function public.admin_send_broadcast(
  p_title text,
  p_body text,
  p_audience text default 'members',
  p_channel text default 'broadcast'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(p_body), '');
  v_audience text := lower(coalesce(nullif(trim(p_audience), ''), 'members'));
  v_channel text := nullif(trim(p_channel), '');
  v_row public.announcements%rowtype;
  v_recipients integer := 0;
begin
  perform public.require_admin();

  if v_title is null or v_body is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_audience not in ('all', 'members', 'coaches', 'active_members', 'app_absent_members', 'test_mlbegueroumi', 'test_youcefamineh') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  -- Ensure only authorized test admins can use the test audiences
  if v_audience in ('test_mlbegueroumi', 'test_youcefamineh') then
    if not exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and lower(u.email) in ('bahaaeddinegueroumi@gmail.com', 'youcefamineh@gmail.com')
    ) then
      raise exception using message = 'FORBIDDEN', errcode = '42501';
    end if;
  end if;

  insert into public.announcements (author_id, channel, title, body)
  values (auth.uid(), coalesce(v_channel, 'broadcast'), v_title, v_body)
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select
    p.id,
    'announcement',
    jsonb_build_object(
      'announcementId', v_row.id,
      'channel', v_row.channel,
      'title', v_row.title,
      'body', v_row.body,
      'audience', v_audience
    )
  from public.profiles p
  where coalesce(public.notification_enabled(p.id, 'announcement'), true)
    and (
      v_audience = 'all'
      or (v_audience = 'members' and p.role in ('member', 'guest'))
      or (v_audience = 'coaches' and p.role = 'coach')
      or (
        v_audience = 'active_members'
        and p.account_status = 'active'
        and p.role in ('member', 'guest')
      )
      or (
        v_audience = 'app_absent_members'
        and p.account_status = 'active'
        and p.role in ('member', 'guest')
        and lower(coalesce(p.membership_status, '')) in ('active', 'current')
        and p.created_at <= now() - interval '14 days'
        and coalesce(
          (
            select max(ci.checked_in_at)
            from public.check_ins ci
            where ci.user_id = p.id
              and ci.checked_in_at >= p.created_at
              and ci.signed_in = true
              and ci.missed = false
              and ci.late_cancelled = false
          ),
          p.created_at
        ) < now() - interval '14 days'
      )
      or (
        v_audience = 'test_mlbegueroumi'
        and p.id in (
          select u.id from auth.users u where lower(u.email) = 'mlbegueroumi+20@gmail.com'
        )
      )
      or (
        v_audience = 'test_youcefamineh'
        and p.id in (
          select u.id from auth.users u where lower(u.email) = 'youcefamineh@gmail.com'
        )
      )
    );

  get diagnostics v_recipients = row_count;

  perform public.write_admin_audit(
    'send_broadcast',
    'announcements',
    v_row.id::text,
    jsonb_build_object(
      'audience', v_audience,
      'channel', v_row.channel,
      'recipientCount', v_recipients
    )
  );

  return jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'body', v_row.body,
    'channel', v_row.channel,
    'audience', v_audience,
    'recipientCount', v_recipients,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke execute on function public.admin_send_broadcast(text, text, text, text) from public, anon;
grant execute on function public.admin_send_broadcast(text, text, text, text) to authenticated;

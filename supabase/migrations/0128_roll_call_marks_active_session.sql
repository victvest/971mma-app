-- in_progress roll call must accept marks even when class starts_at falls on the
-- next Asia/Dubai calendar day (UTC evening → Dubai past midnight).
-- Gym-day gate stays for completed sessions (post-class corrections only).

create or replace function public.roll_call_session_for_marks(p_class_id uuid)
returns setof public.roll_call_sessions
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.roll_call_sessions s
  inner join public.classes c on c.id = s.class_id
  where s.class_id = p_class_id
    and (
      s.status = 'in_progress'
      or (
        s.status = 'completed'
        and to_char((c.starts_at at time zone 'Asia/Dubai')::date, 'YYYY-MM-DD')
          = to_char((now() at time zone 'Asia/Dubai')::date, 'YYYY-MM-DD')
      )
    )
  order by
    case s.status when 'in_progress' then 0 else 1 end,
    s.started_at desc nulls last,
    s.created_at desc
  limit 1;
$$;

revoke execute on function public.roll_call_session_for_marks(uuid) from public, anon;
grant execute on function public.roll_call_session_for_marks(uuid) to authenticated;

-- TINDER Phase 12 — facility cross-over: gym-day check_ins lookup for roll call deck.

create or replace function public.roll_call_facility_check_ins(p_user_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today text;
  v_start timestamptz;
  v_end timestamptz;
begin
  perform public.require_roll_call_coach();

  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return '[]'::jsonb;
  end if;

  v_today := to_char((now() at time zone 'Asia/Dubai')::date, 'YYYY-MM-DD');
  v_start := (v_today || ' 00:00:00+04')::timestamptz;
  v_end := (v_today || ' 23:59:59.999+04')::timestamptz;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'userId', latest.user_id,
          'presentedBy', latest.presented_by
        )
      )
      from (
        select distinct on (ci.user_id)
          ci.user_id,
          ci.presented_by
        from public.check_ins ci
        where ci.user_id = any(p_user_ids)
          and ci.checked_in_at >= v_start
          and ci.checked_in_at <= v_end
        order by ci.user_id, ci.checked_in_at desc
      ) latest
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.roll_call_facility_check_ins(uuid[]) from public, anon;
grant execute on function public.roll_call_facility_check_ins(uuid[]) to authenticated;

-- Points economy integrity: do not award redeemable check-in points for historical
-- Mindbody visits pulled by the mirror.
--
-- Context (see docs/CHECKIN_AUDIT.md, finding #4): mb-visits back-fills up to 365 days
-- of Mindbody visits into check_ins, and the after-insert trigger on_check_in awards 10
-- redeemable points per row. On a member's first attendance refresh this can mint
-- thousands of retroactive points and instantly unlock milestones from history earned
-- before the app existed — an economy-integrity and fairness problem.
--
-- Fix: award_check_in_points skips method = 'mindbody_visit'. Attendance STATS are
-- intentionally left intact — count_training_days / recompute_streak read check_ins by
-- signed_in/missed/late_cancelled regardless of method, so historical training days
-- still build streaks and milestones. Only the redeemable POINTS award is withheld for
-- mirrored history. Live facility entries (gate_scan / qr_scan) and coach-marked
-- attendance (coach_roster / roll_call) continue to earn points as before.

create or replace function public.award_check_in_points(p_user uuid, p_checkin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_checkin is null then
    return;
  end if;

  if exists (
    select 1
    from public.check_ins
    where id = p_checkin
      and (
        signed_in = false
        or missed = true
        or late_cancelled = true
        -- Mirrored Mindbody history is stats-only; it must not mint redeemable points.
        or method = 'mindbody_visit'
      )
  ) then
    return;
  end if;

  perform public.post_points_transaction(
    p_user,
    10,
    'check_in',
    'check_ins',
    p_checkin,
    'check_in:' || p_checkin::text,
    jsonb_build_object('source', 'attendance')
  );
end;
$$;

revoke execute on function public.award_check_in_points(uuid, uuid) from public, anon, authenticated;

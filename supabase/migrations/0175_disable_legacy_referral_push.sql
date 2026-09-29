-- Disable the older two-argument referral notification overload as well.
-- Some award paths still call this signature; referral activity remains visible
-- in the rewards/referrals screens but must not create a phone notification.
create or replace function public.notify_member_referral_awarded(
  p_user uuid,
  p_referral_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;

revoke execute on function public.notify_member_referral_awarded(uuid, uuid)
  from public, anon, authenticated;

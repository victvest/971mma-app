-- Allow members to mark their own promotion celebration as seen (one-time overlay).

create or replace function public.mark_promotion_celebration_seen(p_promotion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  update public.rank_promotions
  set celebration_seen_at = now()
  where id = p_promotion_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.mark_promotion_celebration_seen(uuid) to authenticated;

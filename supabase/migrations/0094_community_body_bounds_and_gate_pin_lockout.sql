-- Hardening: bound community text length, and throttle gate exit-PIN brute force.

-- 1) Community post/reply body: enforce an upper bound in addition to non-empty.
--    (The prior inline check only guaranteed length > 0.)
do $guard$
begin
  if to_regclass('public.community_posts') is not null then
    alter table public.community_posts
      drop constraint if exists community_posts_body_check;
    alter table public.community_posts
      add constraint community_posts_body_check
      check (char_length(trim(body)) between 1 and 5000);
  end if;

  if to_regclass('public.community_replies') is not null then
    alter table public.community_replies
      drop constraint if exists community_replies_body_check;
    alter table public.community_replies
      add constraint community_replies_body_check
      check (char_length(trim(body)) between 1 and 5000);
  end if;
end;
$guard$;

-- 2) Gate exit PIN: 4 digits = 10k combinations. Add a per-caller attempt
--    counter with a 5-minute lockout after 5 consecutive failures.
create table if not exists public.gate_exit_pin_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fail_count int not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);

alter table public.gate_exit_pin_attempts enable row level security;
-- No RLS policies: reachable only through the security-definer function below.

create or replace function public.gate_validate_exit_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_trimmed text;
  v_uid uuid := auth.uid();
  v_locked_until timestamptz;
  v_ok boolean;
begin
  if not public.is_gate_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  -- Throttle: if this caller is locked out, refuse without evaluating the PIN.
  if v_uid is not null then
    select locked_until into v_locked_until
    from public.gate_exit_pin_attempts
    where user_id = v_uid;

    if v_locked_until is not null and v_locked_until > now() then
      return false;
    end if;
  end if;

  v_trimmed := trim(coalesce(p_pin, ''));
  if v_trimmed !~ '^\d{4}$' then
    return false;
  end if;

  select exit_pin_hash into v_hash
  from public.gate_settings
  where id = 1;

  if v_hash is null then
    return false;
  end if;

  v_ok := crypt(v_trimmed, v_hash) = v_hash;

  if v_uid is not null then
    if v_ok then
      -- Correct PIN clears the failure state.
      delete from public.gate_exit_pin_attempts where user_id = v_uid;
    else
      insert into public.gate_exit_pin_attempts as a (user_id, fail_count, last_attempt_at)
      values (v_uid, 1, now())
      on conflict (user_id) do update
      set fail_count = case when a.fail_count + 1 >= 5 then 0 else a.fail_count + 1 end,
          locked_until = case
            when a.fail_count + 1 >= 5 then now() + interval '5 minutes'
            else a.locked_until
          end,
          last_attempt_at = now();
    end if;
  end if;

  return v_ok;
end;
$$;

revoke all on function public.gate_validate_exit_pin(text) from public;
grant execute on function public.gate_validate_exit_pin(text) to authenticated;

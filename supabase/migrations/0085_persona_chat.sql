-- Persona assistant daily usage tracking (rate limit per member, Dubai gym day).

create table if not exists public.persona_chat_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  message_count int not null default 0 check (message_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.persona_chat_daily_usage enable row level security;

create policy persona_chat_daily_usage_select_self
  on public.persona_chat_daily_usage
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.persona_chat_daily_usage from public, anon;
grant select on table public.persona_chat_daily_usage to authenticated;
grant all on table public.persona_chat_daily_usage to service_role;

create or replace function public.persona_increment_chat_usage(
  p_user uuid default auth.uid(),
  p_daily_limit int default 40
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_count int;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if p_user is null or p_user <> auth.uid() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_daily_limit < 1 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.persona_chat_daily_usage (user_id, usage_date, message_count, updated_at)
  values (p_user, v_today, 1, now())
  on conflict (user_id, usage_date)
  do update
    set message_count = public.persona_chat_daily_usage.message_count + 1,
        updated_at = now()
  returning message_count into v_count;

  if v_count > p_daily_limit then
    raise exception using message = 'RATE_LIMITED', errcode = 'P0001';
  end if;

  return v_count;
end;
$$;

revoke all on function public.persona_increment_chat_usage(uuid, int) from public, anon;
grant execute on function public.persona_increment_chat_usage(uuid, int) to authenticated;

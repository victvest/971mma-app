-- Phase 17: per-class subscriptions and Expo push tokens.
--
-- Mindbody boundary:
-- - Subscribe/unsubscribe writes only to Supabase.
-- - Reminder and cancellation push jobs read mirrored public.classes rows only.
-- - No subscriber-specific Mindbody requests are introduced by this migration.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_id text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists idx_push_tokens_user_seen
  on public.push_tokens (user_id, last_seen_at desc);

create table if not exists public.class_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  reminder_sent_at timestamptz,
  cancellation_notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, class_id)
);

create index if not exists idx_class_subscriptions_user_created
  on public.class_subscriptions (user_id, created_at desc);
create index if not exists idx_class_subscriptions_class
  on public.class_subscriptions (class_id);
create index if not exists idx_class_subscriptions_pending_reminder
  on public.class_subscriptions (class_id)
  where reminder_sent_at is null;
create index if not exists idx_class_subscriptions_pending_cancellation
  on public.class_subscriptions (class_id)
  where cancellation_notified_at is null;

create unique index if not exists idx_notifications_class_reminder_once
  on public.notifications (user_id, ((payload->>'classId')))
  where type = 'class_reminder' and payload ? 'classId';

create unique index if not exists idx_notifications_class_cancelled_once
  on public.notifications (user_id, ((payload->>'classId')))
  where type = 'class_cancelled' and payload ? 'classId';

alter table public.push_tokens enable row level security;
alter table public.class_subscriptions enable row level security;

drop policy if exists "push_tokens select own" on public.push_tokens;
create policy "push_tokens select own" on public.push_tokens
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "push_tokens insert own" on public.push_tokens;
create policy "push_tokens insert own" on public.push_tokens
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "push_tokens update own" on public.push_tokens;
create policy "push_tokens update own" on public.push_tokens
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens delete own" on public.push_tokens;
create policy "push_tokens delete own" on public.push_tokens
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "class_subscriptions select own" on public.class_subscriptions;
create policy "class_subscriptions select own" on public.class_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "class_subscriptions insert own" on public.class_subscriptions;
create policy "class_subscriptions insert own" on public.class_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "class_subscriptions update own" on public.class_subscriptions;
create policy "class_subscriptions update own" on public.class_subscriptions
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "class_subscriptions delete own" on public.class_subscriptions;
create policy "class_subscriptions delete own" on public.class_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.upsert_push_token(
  p_token text,
  p_platform text,
  p_device_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := nullif(trim(p_token), '');
  v_platform text := lower(nullif(trim(p_platform), ''));
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if v_token is null or v_platform not in ('ios', 'android', 'web') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, platform, device_id, last_seen_at)
  values (auth.uid(), v_token, v_platform, nullif(trim(p_device_id), ''), now())
  on conflict (user_id, expo_push_token)
  do update set
    platform = excluded.platform,
    device_id = excluded.device_id,
    last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.upsert_push_token(text, text, text) from public, anon;
grant execute on function public.upsert_push_token(text, text, text) to authenticated;

create or replace function public.is_class_subscribed(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.class_subscriptions cs
    where cs.user_id = auth.uid()
      and cs.class_id = p_class_id
  );
$$;

revoke execute on function public.is_class_subscribed(uuid) from public, anon;
grant execute on function public.is_class_subscribed(uuid) to authenticated;

create or replace function public.toggle_class_subscription(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
  v_existing_id uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select *
  into v_class
  from public.classes c
  where c.id = p_class_id;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select cs.id
  into v_existing_id
  from public.class_subscriptions cs
  where cs.user_id = auth.uid()
    and cs.class_id = p_class_id;

  if v_existing_id is not null then
    delete from public.class_subscriptions
    where id = v_existing_id;

    return jsonb_build_object('subscribed', false);
  end if;

  if v_class.is_cancelled then
    raise exception using message = 'CLASS_CANCELLED', errcode = 'P0001';
  end if;

  if v_class.starts_at <= now() then
    raise exception using message = 'CLASS_STARTED', errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.push_tokens pt
    where pt.user_id = auth.uid()
  ) then
    raise exception using message = 'PUSH_TOKEN_REQUIRED', errcode = 'P0001';
  end if;

  insert into public.class_subscriptions (user_id, class_id)
  values (auth.uid(), p_class_id);

  return jsonb_build_object('subscribed', true);
end;
$$;

revoke execute on function public.toggle_class_subscription(uuid) from public, anon;
grant execute on function public.toggle_class_subscription(uuid) to authenticated;

create or replace function public.insert_class_notifications_once(
  p_user_ids uuid[],
  p_type text,
  p_class_id uuid,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted integer := 0;
  v_row_count integer;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('classId', p_class_id);
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return 0;
  end if;

  if p_type not in ('class_reminder', 'class_cancelled') or p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  foreach v_user_id in array p_user_ids loop
    if v_user_id is null then
      continue;
    end if;

    begin
      insert into public.notifications (user_id, type, payload)
      select v_user_id, p_type, v_payload
      where not exists (
        select 1
        from public.notifications n
        where n.user_id = v_user_id
          and n.type = p_type
          and n.payload->>'classId' = p_class_id::text
      );

      get diagnostics v_row_count = row_count;
      v_inserted := v_inserted + v_row_count;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return v_inserted;
end;
$$;

revoke execute on function public.insert_class_notifications_once(uuid[], text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.insert_class_notifications_once(uuid[], text, uuid, jsonb)
  to service_role;

create or replace function public.notify_class_cancelled_subscribers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ids uuid[];
  v_class_title text := coalesce(nullif(trim(new.title), ''), 'class');
  v_payload jsonb;
begin
  if coalesce(old.is_cancelled, false) = false and new.is_cancelled = true then
    select coalesce(array_agg(cs.user_id), array[]::uuid[])
    into v_user_ids
    from public.class_subscriptions cs
    where cs.class_id = new.id;

    v_payload := jsonb_build_object(
      'title', 'Class cancelled',
      'body', format('Your %s class has been cancelled.', v_class_title),
      'classTitle', new.title,
      'discipline', new.discipline,
      'coachName', new.coach_name,
      'startsAt', new.starts_at
    );

    perform public.insert_class_notifications_once(
      v_user_ids,
      'class_cancelled',
      new.id,
      v_payload
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_class_cancelled_subscribers on public.classes;
create trigger trg_notify_class_cancelled_subscribers
  after update of is_cancelled on public.classes
  for each row
  execute function public.notify_class_cancelled_subscribers();

-- Scheduling note:
-- Invoke supabase/functions/class-reminders every 10 minutes with CRON_SECRET.
-- It sends both 1-hour reminders and cancellation push catch-up for rows where
-- class_subscriptions.cancellation_notified_at is still null. Use Supabase
-- scheduled functions, pg_cron + pg_net, GitHub Actions, or another scheduler.

-- ============================================================
-- 0172_notification_push_trigger.sql
--
-- Fires an Expo device push notification for every new row
-- inserted into public.notifications, via the notification-push
-- Edge Function.
--
-- Architecture:
--   notifications INSERT → trigger → pg_net HTTP POST → notification-push Edge Function
--                        → push_tokens lookup → Expo Push API → device
--
-- Secrets in vault.decrypted_secrets:
--   app_supabase_url         — project URL (set via vault.create_secret)
--   notification_push_secret — dedicated auth secret for notification-push
--
-- Types skipped (already pushed by dedicated schedulers):
--   class_reminder, class_cancelled — class-reminders cron
--   streak_warning                  — streak-reminders cron
--   community                       — community-push flow
--
-- NOTE: pg_net, Vault secrets, and the Supabase Edge Function
-- notification-push must all be deployed before this trigger
-- will actually fire pushes. The trigger fails silently (logs
-- a warning) if secrets are missing so notification inserts
-- always succeed regardless.
-- ============================================================

-- Ensure pg_net is available
create extension if not exists pg_net with schema extensions;

-- ── Trigger function ──────────────────────────────────────────────────────────

create or replace function public.trigger_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_skip_types  text[] := array[
    'class_reminder',
    'class_cancelled',
    'streak_warning'
  ];
  v_supabase_url   text;
  v_push_secret    text;
  v_edge_url       text;
begin
  -- Skip types already handled by dedicated schedulers.
  if NEW.type = any(v_skip_types) then
    return NEW;
  end if;

  -- Read secrets from Vault (encrypted at rest).
  select decrypted_secret into v_supabase_url
  from vault.decrypted_secrets
  where name = 'app_supabase_url'
  limit 1;

  select decrypted_secret into v_push_secret
  from vault.decrypted_secrets
  where name = 'notification_push_secret'
  limit 1;

  -- Bail gracefully if secrets not configured yet.
  if v_supabase_url is null or v_push_secret is null then
    raise warning '[notification-push] Vault secrets not set — skipping push for notification %', NEW.id;
    return NEW;
  end if;

  v_edge_url := v_supabase_url || '/functions/v1/notification-push';

  -- Fire-and-forget HTTP POST via pg_net.
  -- net.http_post signature: (url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds int)
  perform net.http_post(
    url     := v_edge_url,
    body    := jsonb_build_object(
                 'user_id', NEW.user_id,
                 'type',    NEW.type,
                 'payload', coalesce(NEW.payload, '{}'::jsonb)
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_push_secret
               )
  );

  return NEW;
exception
  when others then
    -- Never let push errors roll back the notification insert.
    raise warning '[notification-push] pg_net error for notification %: %', NEW.id, sqlerrm;
    return NEW;
end;
$$;

-- ── Trigger ───────────────────────────────────────────────────────────────────

drop trigger if exists on_notification_insert_push on public.notifications;

create trigger on_notification_insert_push
  after insert on public.notifications
  for each row
  execute function public.trigger_notification_push();

-- ── Permissions ───────────────────────────────────────────────────────────────

revoke execute on function public.trigger_notification_push() from public, anon, authenticated;
grant  execute on function public.trigger_notification_push() to service_role;

-- ── One-time setup (already applied in production) ───────────────────────────
-- Run these once in the SQL editor when first deploying to a new project:
--
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
--
-- SELECT vault.create_secret(
--   'https://<project-ref>.supabase.co',
--   'app_supabase_url',
--   'Supabase project URL for pg_net calls'
-- );
--
-- SELECT vault.create_secret(
--   '<generate with: openssl rand -hex 32>',
--   'notification_push_secret',
--   'Auth secret for notification-push Edge Function'
-- );
--
-- Also set in Supabase Edge Secrets:
-- npx supabase secrets set NOTIFICATION_PUSH_SECRET=<same-value> --project-ref <ref>

-- Run the time-based push jobs inside the hosted Supabase project.
-- The commands read the existing Vault secrets at execution time, so no
-- secret value is stored in pg_cron.job.command.

create extension if not exists pg_cron with schema extensions;

do $$
declare
  v_job_command text := $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_supabase_url')
    || '/functions/v1/%s',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notification_push_secret')
  ),
  body := '{}'::jsonb
);
$job$;
begin
  if not exists (select 1 from cron.job where jobname = '971-class-reminders') then
    perform cron.schedule(
      '971-class-reminders',
      '*/10 * * * *',
      format(v_job_command, 'class-reminders')
    );
  end if;

  if not exists (select 1 from cron.job where jobname = '971-streak-reminders') then
    perform cron.schedule(
      '971-streak-reminders',
      '0 14 * * *',
      format(v_job_command, 'streak-reminders')
    );
  end if;
end;
$$;

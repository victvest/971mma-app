-- Phase 14: Security hardening — block authenticated writes on engine-owned tables.

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'qr_tokens',
        'member_memberships',
        'admin_audit_log',
        'mb_tokens',
        'mb_cache'
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Belt tables: members must not write; coach RPCs are security definer.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'member_belt_progress',
        'member_requirement_status',
        'promotions'
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- No direct authenticated inserts into audit log (RPC-internal + service role only).
drop policy if exists "admin_audit_log insert admin" on public.admin_audit_log;

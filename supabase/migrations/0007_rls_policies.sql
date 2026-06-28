-- Phase 1: RLS coverage for all new domain tables and tighter check-in writes.

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.bookings enable row level security;
alter table public.check_ins enable row level security;
alter table public.mindbody_links enable row level security;
alter table public.programs enable row level security;
alter table public.coaches enable row level security;
alter table public.belt_ranks enable row level security;
alter table public.belt_requirements enable row level security;
alter table public.member_belt_progress enable row level security;
alter table public.member_requirement_status enable row level security;
alter table public.promotions enable row level security;
alter table public.points_accounts enable row level security;
alter table public.points_ledger enable row level security;
alter table public.milestones enable row level security;
alter table public.member_milestones enable row level security;
alter table public.rewards_catalog enable row level security;
alter table public.redemptions enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.lineage_entries enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.discipline_scores enable row level security;

-- Members must not directly write attendance. Phase 6 writes check-ins via Edge/service role.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'check_ins'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.check_ins', p.policyname);
  end loop;
end $$;

-- Core table safety policies, using distinct names so existing MCP policies can coexist.
drop policy if exists "classes read all phase1" on public.classes;
create policy "classes read all phase1" on public.classes
  for select to authenticated using (true);

drop policy if exists "check_ins select own phase1" on public.check_ins;
create policy "check_ins select own phase1" on public.check_ins
  for select to authenticated using (auth.uid() = user_id);

-- Identity bridge: read-own only; service role writes.
drop policy if exists "mindbody_links select own" on public.mindbody_links;
create policy "mindbody_links select own" on public.mindbody_links
  for select to authenticated using (auth.uid() = user_id);

-- Public/static reference data: authenticated users can read; admins curate.
drop policy if exists "programs select all" on public.programs;
create policy "programs select all" on public.programs
  for select to authenticated using (true);
drop policy if exists "programs insert admin" on public.programs;
create policy "programs insert admin" on public.programs
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "programs update admin" on public.programs;
create policy "programs update admin" on public.programs
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "programs delete admin" on public.programs;
create policy "programs delete admin" on public.programs
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "coaches select all" on public.coaches;
create policy "coaches select all" on public.coaches
  for select to authenticated using (true);
drop policy if exists "coaches insert admin" on public.coaches;
create policy "coaches insert admin" on public.coaches
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "coaches update admin" on public.coaches;
create policy "coaches update admin" on public.coaches
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "coaches delete admin" on public.coaches;
create policy "coaches delete admin" on public.coaches
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "belt_ranks select all" on public.belt_ranks;
create policy "belt_ranks select all" on public.belt_ranks
  for select to authenticated using (true);
drop policy if exists "belt_ranks insert admin" on public.belt_ranks;
create policy "belt_ranks insert admin" on public.belt_ranks
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "belt_ranks update admin" on public.belt_ranks;
create policy "belt_ranks update admin" on public.belt_ranks
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "belt_ranks delete admin" on public.belt_ranks;
create policy "belt_ranks delete admin" on public.belt_ranks
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "belt_requirements select all" on public.belt_requirements;
create policy "belt_requirements select all" on public.belt_requirements
  for select to authenticated using (true);
drop policy if exists "belt_requirements insert admin" on public.belt_requirements;
create policy "belt_requirements insert admin" on public.belt_requirements
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "belt_requirements update admin" on public.belt_requirements;
create policy "belt_requirements update admin" on public.belt_requirements
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "belt_requirements delete admin" on public.belt_requirements;
create policy "belt_requirements delete admin" on public.belt_requirements
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "milestones select all" on public.milestones;
create policy "milestones select all" on public.milestones
  for select to authenticated using (true);
drop policy if exists "milestones insert admin" on public.milestones;
create policy "milestones insert admin" on public.milestones
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "milestones update admin" on public.milestones;
create policy "milestones update admin" on public.milestones
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "milestones delete admin" on public.milestones;
create policy "milestones delete admin" on public.milestones
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "rewards_catalog select all" on public.rewards_catalog;
create policy "rewards_catalog select all" on public.rewards_catalog
  for select to authenticated using (true);
drop policy if exists "rewards_catalog insert admin" on public.rewards_catalog;
create policy "rewards_catalog insert admin" on public.rewards_catalog
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "rewards_catalog update admin" on public.rewards_catalog;
create policy "rewards_catalog update admin" on public.rewards_catalog
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "rewards_catalog delete admin" on public.rewards_catalog;
create policy "rewards_catalog delete admin" on public.rewards_catalog
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "lineage_entries select all" on public.lineage_entries;
create policy "lineage_entries select all" on public.lineage_entries
  for select to authenticated using (true);
drop policy if exists "lineage_entries insert admin" on public.lineage_entries;
create policy "lineage_entries insert admin" on public.lineage_entries
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "lineage_entries update admin" on public.lineage_entries;
create policy "lineage_entries update admin" on public.lineage_entries
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "lineage_entries delete admin" on public.lineage_entries;
create policy "lineage_entries delete admin" on public.lineage_entries
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Member-owned data: read-own only unless coach/admin review is explicitly needed.
drop policy if exists "member_belt_progress select own" on public.member_belt_progress;
create policy "member_belt_progress select own" on public.member_belt_progress
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "member_belt_progress insert coach admin" on public.member_belt_progress;
create policy "member_belt_progress insert coach admin" on public.member_belt_progress
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );
drop policy if exists "member_belt_progress update coach admin" on public.member_belt_progress;
create policy "member_belt_progress update coach admin" on public.member_belt_progress
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );

drop policy if exists "member_requirement_status select own" on public.member_requirement_status;
create policy "member_requirement_status select own" on public.member_requirement_status
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "member_requirement_status insert coach admin" on public.member_requirement_status;
create policy "member_requirement_status insert coach admin" on public.member_requirement_status
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );
drop policy if exists "member_requirement_status update coach admin" on public.member_requirement_status;
create policy "member_requirement_status update coach admin" on public.member_requirement_status
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );

drop policy if exists "promotions select own" on public.promotions;
create policy "promotions select own" on public.promotions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "promotions insert coach admin" on public.promotions;
create policy "promotions insert coach admin" on public.promotions
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );

drop policy if exists "points_accounts select own" on public.points_accounts;
create policy "points_accounts select own" on public.points_accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "points_ledger select own" on public.points_ledger;
create policy "points_ledger select own" on public.points_ledger
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "member_milestones select own" on public.member_milestones;
create policy "member_milestones select own" on public.member_milestones
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "redemptions select own" on public.redemptions;
create policy "redemptions select own" on public.redemptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "qr_tokens select own" on public.qr_tokens;
create policy "qr_tokens select own" on public.qr_tokens
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "discipline_scores select own" on public.discipline_scores;
create policy "discipline_scores select own" on public.discipline_scores
  for select to authenticated using (auth.uid() = user_id);

-- Announcements are visible to signed-in users; coaches/admins curate them.
drop policy if exists "announcements select all" on public.announcements;
create policy "announcements select all" on public.announcements
  for select to authenticated using (true);
drop policy if exists "announcements insert coach admin" on public.announcements;
create policy "announcements insert coach admin" on public.announcements
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );
drop policy if exists "announcements update coach admin" on public.announcements;
create policy "announcements update coach admin" on public.announcements
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );
drop policy if exists "announcements delete coach admin" on public.announcements;
create policy "announcements delete coach admin" on public.announcements
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'))
  );

-- Notifications are user-scoped; service role creates them, users may mark/read/delete own.
drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own" on public.notifications
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications
  for delete to authenticated using (auth.uid() = user_id);

-- Lineage is public academy content; anonymous guests (no Supabase session) must read it.

drop policy if exists "lineage_entries select all" on public.lineage_entries;
create policy "lineage_entries select all" on public.lineage_entries
  for select to authenticated, anon using (true);

-- Reset academy-seeded coaches. Directory is repopulated from Mindbody via mb-staff.
-- Safe to run before first production Mindbody staff sync.

-- Detach class rows (coach_id is ON DELETE SET NULL; explicit for clarity).
update public.classes
set coach_id = null
where coach_id is not null;

-- Cascades: coach_disciplines, coach_member_notes, community_channels, …
delete from public.coaches;

-- Clear stale staff-link cache so the next mb-staff run is unconditional.
delete from public.mb_cache
where cache_key = 'staff:link';

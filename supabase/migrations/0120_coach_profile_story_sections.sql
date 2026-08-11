-- Additive coach profile fields from 971mma Instagram coach stories.
-- Story pattern per coach: Hero → Status & Achievements → Experience → Coaching Style → Invite CTA.
-- Existing coaches columns are intentionally left unchanged.

alter table public.coaches
  add column if not exists nickname text,
  add column if not exists years_martial_arts int
    check (years_martial_arts is null or years_martial_arts >= 0),
  add column if not exists years_coaching int
    check (years_coaching is null or years_coaching >= 0),
  add column if not exists status_achievements jsonb not null default '[]'::jsonb,
  add column if not exists experience_highlights jsonb not null default '[]'::jsonb,
  add column if not exists coaching_style jsonb not null default '[]'::jsonb,
  add column if not exists invite_blurb text;

comment on column public.coaches.nickname is
  'Optional display nickname / ring name (e.g. Wagner for Gabriel Lopes Silva).';

comment on column public.coaches.years_martial_arts is
  'Total years practicing martial arts when distinct from coaching tenure.';

comment on column public.coaches.years_coaching is
  'Years as a professional coach when distinct from years_experience.';

comment on column public.coaches.status_achievements is
  'Ordered bullet list for the Status & Achievements profile section (jsonb string array).';

comment on column public.coaches.experience_highlights is
  'Ordered bullet list for the Experience profile section (jsonb string array).';

comment on column public.coaches.coaching_style is
  'Ordered bullet list (or single prose item) for the Coaching Style profile section (jsonb string array).';

comment on column public.coaches.invite_blurb is
  'Closing CTA invite copy (classes offered, audience, private training, etc.).';

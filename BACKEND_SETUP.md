# 971 MMA — Backend Setup

Supabase backend for the 971 MMA membership app (React Native / Expo + TypeScript).

> **App wiring:** the app talks to these tables through a typed data layer
> (`src/services/db.ts`) and a provider abstraction (`src/services/integrations/`)
> that makes member/check-in concerns swappable to Mindbody later. See
> [`INTEGRATIONS.md`](./INTEGRATIONS.md) for the provider contract and QR token format.

## Project

| Key | Value |
| --- | --- |
| Project name | 971mma app |
| Project ref / ID | `nzbbpduwahcncyvyjusj` |
| Region | eu-west-3 |
| Postgres | 17 |
| `SUPABASE_URL` | `https://nzbbpduwahcncyvyjusj.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (set in app env, do not commit) |

All objects were provisioned via Supabase MCP migrations (`apply_migration`).

## Migrations applied

1. `create_core_schema` — tables, indexes, triggers
2. `enable_rls_policies` — RLS + policies on all four tables
3. `seed_classes` — 8 upcoming classes
4. `harden_functions` — pinned `search_path` and revoked public EXECUTE on trigger functions

## Schema

### `public.profiles`
One row per user, keyed to `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | FK → `auth.users(id)` on delete cascade |
| `full_name` | text | |
| `avatar_url` | text | |
| `phone` | text | |
| `membership_tier` | text | default `'standard'` (standard, pro, elite) |
| `membership_status` | text | default `'active'` (active, paused, expired) |
| `membership_expires_at` | timestamptz | |
| `belt_rank` | text | |
| `belt_stripes` | int | default `0` |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()`, auto-maintained by trigger |

### `public.classes`
Scheduled gym classes (read-only for members).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | default `gen_random_uuid()` |
| `title` | text | not null |
| `discipline` | text | BJJ, Muay Thai, MMA, Boxing, Wrestling |
| `description` | text | |
| `coach_name` | text | |
| `starts_at` | timestamptz | not null (indexed) |
| `duration_minutes` | int | default `60` |
| `capacity` | int | default `20` |
| `level` | text | All Levels, Beginner, Intermediate, Advanced |
| `image_url` | text | |
| `created_at` | timestamptz | default `now()` |

### `public.bookings`
A member booking a class.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users(id)` on delete cascade |
| `class_id` | uuid | FK → `classes(id)` on delete cascade |
| `status` | text | default `'booked'` (booked, waitlisted, cancelled, attended) |
| `created_at` | timestamptz | default `now()` |
| | | `unique (user_id, class_id)` — one booking per user per class |

### `public.check_ins`
QR check-in events.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users(id)` on delete cascade |
| `class_id` | uuid | FK → `classes(id)` on delete set null |
| `checked_in_at` | timestamptz | default `now()` |
| `method` | text | default `'qr'` |

### Triggers & functions
- `public.handle_new_user()` (SECURITY DEFINER) — `AFTER INSERT ON auth.users`. Inserts a `profiles` row, copying `full_name` from `raw_user_meta_data->>'full_name'` (falls back to `->>'name'`). Idempotent via `ON CONFLICT (id) DO NOTHING`.
- `public.set_updated_at()` — `BEFORE UPDATE ON profiles`, keeps `updated_at` current. `search_path` pinned to `''`.
- Both trigger functions have EXECUTE revoked from `public`, `anon`, and `authenticated` so they aren't callable via the REST RPC endpoint.

## Row Level Security

RLS is **enabled on all four tables**. All policies target the `authenticated` role.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | own (`auth.uid() = id`) | own | own | — |
| `classes` | all (`using true`) | — | — | — |
| `bookings` | own (`auth.uid() = user_id`) | own | own | own |
| `check_ins` | own (`auth.uid() = user_id`) | own | — | — |

Notes:
- `classes` is read-only for members; inserts/updates/deletes must go through the service role (e.g. admin tooling), which bypasses RLS.
- No anonymous (`anon`) access is granted to any table.

## Seed data

**8 upcoming classes** inserted (times are relative to `now()` at provision time, spread across the next 6 days):

| Class | Discipline | Coach | Level | Capacity |
| --- | --- | --- | --- | --- |
| BJJ Fundamentals | Brazilian Jiu Jitsu | Rafael Souza | Beginner | 24 |
| Muay Thai Striking | Muay Thai | Anan Phukan | All Levels | 20 |
| Boxing Basics | Boxing | Mike Donnelly | Beginner | 22 |
| MMA Conditioning | MMA | Khalid Al Marzooqi | Intermediate | 18 |
| Advanced No-Gi | Brazilian Jiu Jitsu | Rafael Souza | Advanced | 16 |
| Wrestling | Wrestling | Dmitri Volkov | Intermediate | 18 |
| Kids BJJ | Brazilian Jiu Jitsu | Layla Hassan | Beginner | 30 |
| Open Mat | MMA | Khalid Al Marzooqi | All Levels | 40 |

## Auth

The Supabase MCP server exposed for this project does **not** include a tool to read or modify Auth settings (no auth-config tool among the available tools). As a result, **email signup could not be verified or toggled via MCP**. Email/password signup is enabled by default on new Supabase projects, but this should be confirmed manually in the dashboard:

> Dashboard → Authentication → Sign In / Providers → Email → ensure "Enable email provider" / "Allow new users to sign up" is ON.

## Security advisors

After applying DDL, `get_advisors(type: security)` initially flagged mutable `search_path` and publicly-executable SECURITY DEFINER functions. These were remediated in the `harden_functions` migration. A re-check returned **no remaining security lints**.

## Steps NOT completed via MCP

- **Auth email-signup verification/toggle** — no MCP tool available for Auth configuration. Confirm manually in the dashboard (see Auth section above).

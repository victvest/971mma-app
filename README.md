# 971 MMA — Member App

A premium membership app for **971 MMA & Fitness Academy**, built with **Expo +
React Native + TypeScript**.

The design uses a clean **white theme with UAE-flag accents** — deep green
(`#15633A`) as the primary, brand red (`#E8192C`) for live states, on white
surfaces with near-black ink type — paired with the real 971 logo and gym photography.

## Features

- **Email auth** via Supabase with persisted sessions (AsyncStorage). Auth-gated:
  logged out → Login/Signup, logged in → bottom tabs.
- **Bottom tab navigation** with a custom glassmorphic (blur) tab bar:
  - **Home** — greeting, next-up class, today's schedule, monthly goal, belt progress, announcements.
  - **Scan** — member QR pass + camera QR check-in (writes to `check_ins`), with a simulator fallback.
  - **Classes** — Today / This week toggle, discipline filters, grouped schedule, book/cancel.
  - **Profile** — real profile, membership card, belt rank/stripes, editable details, sign out.
- **Live Supabase data** with graceful **mock fallback** so the UI never looks broken.
- **Mindbody-ready** provider abstraction (see [`INTEGRATIONS.md`](./INTEGRATIONS.md)).

## Live vs. mocked data

| Area | Source |
| --- | --- |
| Auth / sessions | **Supabase** (live) |
| Classes / schedule | **Supabase** `classes` (live) → mock if empty |
| Booking / cancel | **Supabase** `bookings` (live) |
| Member profile, membership tier/status/expiry, belt | **Supabase** `profiles` (live) → mock if missing |
| QR check-in | **Supabase** `check_ins` (live insert) |
| Belt requirements checklist, monthly-goal count, recent activity, announcements | **Mock** (no table yet) |

## Getting started

```bash
npm install
cp .env.example .env     # fill in EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
npm start                # press i (iOS), a (Android), or scan in Expo Go
```

> The app ships with a public-anon-key fallback so it still boots without a
> `.env`, but configuring `.env` is the supported path. The anon key is a
> publishable client key protected by row-level security.

## Environment

Config is read via `src/config/env.ts` from Expo `extra` (injected by
`app.config.ts` from `.env`) → `EXPO_PUBLIC_*` → public fallback. See
`.env.example`.

## Tech stack

- Expo SDK 56, React Native 0.85, React 19, TypeScript
- `@supabase/supabase-js` (+ AsyncStorage session persistence)
- React Navigation (native-stack + bottom-tabs), custom blur tab bar (`expo-blur`)
- `expo-camera` (QR), `expo-haptics`, `expo-linear-gradient`, `@expo/vector-icons`

## Project structure

```
src/
  components/    # Logo, Card, Button, Chip, TextField, AppHeader, ClassCard,
                 # GlassTabBar, QrCode, EditProfileSheet, primitives
  config/        # env.ts, integrations.ts (provider switchboard)
  context/       # AuthContext (Supabase session)
  data/          # mockData.ts (fallback), classPresentation.ts (row→display)
  hooks/         # useClasses, useProfile
  lib/           # supabase.ts (client)
  navigation/    # RootNavigator (auth gate), TabNavigator
  screens/       # auth/Login, auth/Signup, Home, Scan, Classes, Profile
  services/      # db.ts (typed data layer), qrToken.ts,
                 # integrations/ (MemberProvider/CheckInProvider, Supabase + Mindbody)
  types/         # database.ts (rows), models.ts (domain)
  theme/         # colors, spacing, radii, typography, shadow
```

## Backend & integrations

- **Supabase schema, RLS, seed data:** [`BACKEND_SETUP.md`](./BACKEND_SETUP.md)
- **Provider abstraction, Mindbody migration, QR token format:** [`INTEGRATIONS.md`](./INTEGRATIONS.md)

Flip member/check-in backends from Supabase to Mindbody by setting
`EXPO_PUBLIC_MEMBER_PROVIDER=mindbody` (or editing `src/config/integrations.ts`)
and implementing the `TODO`s in `src/services/integrations/mindbodyProvider.ts`.
No screen changes required.

# 971 MMA App — Agent Context & Handoff

> **Read this first.** This document is the single source of truth for any agent
> (cloud or local) picking up work on this repo. It captures the full history,
> intent, design decisions, current state, and what to do next. After reading
> this, also read `README.md`, `BACKEND_SETUP.md`, and `INTEGRATIONS.md`, then
> skim `src/` before making changes.

---

## 1. What this project is

A premium **membership mobile app** for **971 MMA**, a high-end MMA / fitness
gym (Dubai, UAE — the "971" is the UAE dialing code). Built with **Expo +
React Native + TypeScript**.

The app is the member-facing "command center": members log in, see their next
class and schedule, book/cancel classes, check in via QR, and view their
membership + belt progress.

---

## 2. Origin & how we got here (conversation summary)

This repo was built in a single Cursor session. Key events, in order:

1. **Initial brief** asked for an Expo + TS app for 971 MMA with Supabase email
   auth, bottom tabs (Home, Scan, Classes, Profile), auth gating, and — per the
   original prompt — a **dark theme with purple `#B09FDE`** accent.
2. **The owner rejected the purple/dark theme** ("DON'T USE THE PURPLE OR DARK
   THEME, it's a stupid prompt from Claude"). The corrected direction:
   - **Pure WHITE theme**
   - **UAE-flag-inspired accents**: green + red, with black used mainly for text.
   - "Follow the screenshots to understand the vibe."
3. We studied the real brand assets (the black `971` logo, the
   `971-app-home-desktop` mockups) and locked the palette below.
4. Built the full app (all screens, auth, tabs, glassmorphic tab bar).
5. Provisioned the **Supabase backend** (schema, RLS, seed data) via MCP.
6. Wired screens to live Supabase data with mock fallback.
7. Added a **Mindbody-ready integration abstraction** (see §6).
8. Pushed to GitHub: **`git@github.com:victvest/971mma-app.git`** (branch `main`).

### Design direction (LOCKED — do not revert to dark/purple)
- **Theme:** clean, premium, **white** surfaces, near-black ink type.
- **Primary accent:** deep green `#15633A`.
- **Alert / live accent:** brand red `#E8192C`.
- **Vibe:** UAE flag energy (green/red/black on white), high-end, not "vibe-coded".
- Real 971 logo (`assets/brand/971-logo-black.png`) and gym photography.
- Canonical theme tokens live in `src/theme/` — **always use these, never
  hardcode colors.**

---

## 3. Tech stack

- Expo SDK 56, React Native 0.85, React 19, TypeScript ~6
- `@supabase/supabase-js` + AsyncStorage session persistence
- React Navigation (native-stack auth gate + bottom-tabs)
- `expo-blur` (glass tab bar), `expo-camera` (QR), `expo-haptics`,
  `expo-linear-gradient`, `@expo/vector-icons`, `react-native-svg`

---

## 4. Project structure

```
src/
  components/    # Logo, Card, Button, Chip, TextField, AppHeader, ClassCard,
                 # GlassTabBar, QrCode, EditProfileSheet, primitives
  config/        # env.ts, integrations.ts (provider switchboard)
  context/       # AuthContext (Supabase session)
  data/          # mockData.ts (fallback), classPresentation.ts (row -> display)
  hooks/         # useClasses, useProfile
  lib/           # supabase.ts (client)
  navigation/    # RootNavigator (auth gate), TabNavigator
  screens/       # auth/Login, auth/Signup, Home, Scan, Classes, Profile
  services/      # db.ts (typed data layer), qrToken.ts,
                 # integrations/ (MemberProvider/CheckInProvider, Supabase + Mindbody)
  types/         # database.ts (rows), models.ts (domain)
  theme/         # colors, spacing, radii, typography, shadow
```

---

## 5. Backend (Supabase)

- Project ref: **`nzbbpduwahcncyvyjusj`** (`https://nzbbpduwahcncyvyjusj.supabase.co`)
- Tables (RLS enabled, owner-scoped): **`profiles`, `classes`, `bookings`,
  `check_ins`**. `classes` is read-only for authenticated users; 8 classes seeded.
- A `profiles` row is auto-created on signup via a trigger (copies `full_name`
  from auth user metadata).
- Full schema, RLS matrix, and seed details: **`BACKEND_SETUP.md`**.
- **Action item (human):** confirm email signup is enabled in
  Supabase Dashboard → Authentication → Email provider (couldn't be toggled via MCP).

### Live vs mocked data
| Area | Source |
| --- | --- |
| Auth / sessions | Supabase (live) |
| Classes / schedule | Supabase `classes` (live) → mock if empty |
| Booking / cancel | Supabase `bookings` (live) |
| Member profile, membership, belt | Supabase `profiles` (live) → mock if missing |
| QR check-in | Supabase `check_ins` (live insert) |
| Belt requirements, monthly goal, recent activity, announcements | Mock (no table yet) |

---

## 6. Mindbody integration (planned — be ready, don't break the abstraction)

The gym uses **Mindbody** and will connect it later. Per the owner, Mindbody is
**mainly for (a) QR-code scan login / check-in and (b) member profiles.**

The codebase is already structured for this as a **drop-in**:
- `src/services/integrations/types.ts` — `MemberProvider` / `CheckInProvider`
  interfaces (provider-agnostic return types).
- `src/services/integrations/supabaseProvider.ts` — current default impl.
- `src/services/integrations/mindbodyProvider.ts` — **stub with TODOs**; this is
  where Mindbody Public API v6 calls go.
- `src/config/integrations.ts` — single switch
  (`EXPO_PUBLIC_MEMBER_PROVIDER` / `EXPO_PUBLIC_CHECKIN_PROVIDER`,
  values `supabase` | `mindbody`).
- QR token format documented in `INTEGRATIONS.md` — designed to resolve to a
  Supabase profile now or a Mindbody member later.

**Rule:** screens depend on the provider interface, NOT directly on Supabase or
Mindbody for member/check-in concerns. Keep it that way.

---

## 7. Current status

- ✅ App builds & bundles clean; runs end to end against live Supabase.
- ✅ All 4 tabs + auth screens implemented (not placeholders).
- ✅ Backend provisioned + seeded.
- ✅ Pushed to GitHub `victvest/971mma-app` (`main`).
- ⏳ Mindbody provider is a stub (intentionally).
- ⏳ Some secondary data still mocked (belt requirements, announcements, etc.).

---

## 8. Conventions for contributors / agents

- **Do not** reintroduce a dark theme or purple accents. White + green/red/black only.
- Use `src/theme/` tokens; never hardcode colors/spacing.
- Keep member/check-in logic behind the provider interface.
- Never commit real secrets. `.env` is gitignored; `.env.example` documents keys.
  The Supabase anon key is publishable (RLS-protected) and has a safe fallback in
  `src/config/env.ts`.
- Keep the app runnable: after changes, run a typecheck and an Expo bundle.

---

## 9. Good first tasks (suggestions)

- Implement the `mindbodyProvider.ts` TODOs once API credentials exist.
- Add a `bookings` history / "my classes" view.
- Move remaining mocked sections (belt requirements, announcements) to real tables.
- Add pull-to-refresh + loading/empty/error states polish across screens.
- Add unit tests for `qrToken.ts` and the data layer.

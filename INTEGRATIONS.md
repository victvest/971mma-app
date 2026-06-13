# 971 MMA — Integrations

The app is built so the **member identity** and **check-in** backends are
swappable. Today everything runs on **Supabase**; **Mindbody** can be dropped in
later (mainly for QR check-in/login and member profiles) **without touching any
screen**.

## Architecture

```
screens/  ──►  services/integrations  ──►  SupabaseProvider ──► services/db ──► Supabase
                       │  (interfaces)  └──► MindbodyProvider ──► Mindbody Public API v6 (later)
                       ▼
              config/integrations.ts  (ACTIVE_* switches + Mindbody creds)
```

- **`src/services/integrations/types.ts`** — `MemberProvider`, `CheckInProvider`,
  and the combined `IntegrationProvider` interfaces. Return types are the
  provider-agnostic domain models in `src/types/models.ts` (never Supabase rows).
- **`src/services/integrations/supabaseProvider.ts`** — default implementation,
  built on the typed `src/services/db.ts` data layer.
- **`src/services/integrations/mindbodyProvider.ts`** — stub. Every method throws
  `"Mindbody is not configured yet…"` until credentials are provided, with `TODO`s
  marking the exact Mindbody Public API v6 endpoints to call.
- **`src/services/integrations/index.ts`** — resolves the active provider and
  exports the `members` / `checkIns` singletons that screens import.
- **`src/config/integrations.ts`** — the single switchboard.

## Flipping to Mindbody

1. Set env (in `.env`):
   ```
   EXPO_PUBLIC_MEMBER_PROVIDER=mindbody
   EXPO_PUBLIC_CHECKIN_PROVIDER=mindbody
   EXPO_PUBLIC_MINDBODY_BASE_URL=https://api.mindbodyonline.com/public/v6
   EXPO_PUBLIC_MINDBODY_API_KEY=...     # Mindbody API key
   EXPO_PUBLIC_MINDBODY_SITE_ID=...     # gym SiteId
   ```
   (or change `ACTIVE_MEMBER_PROVIDER` / `ACTIVE_CHECKIN_PROVIDER` directly in
   `src/config/integrations.ts`.)
2. Implement the `TODO`s in `mindbodyProvider.ts`:
   - **Auth** — `POST {baseUrl}/usertoken/issue` with `Api-Key` + `SiteId`
     headers → cache the returned AccessToken as `Authorization`.
   - **getMemberProfile** — `GET {baseUrl}/client/clients?clientIds={id}`.
   - **listMemberships** — `GET {baseUrl}/client/clientcontracts`.
   - **recordCheckIn** — `POST {baseUrl}/class/addclienttoclass` and/or the
     arrivals/check-in endpoint.
3. No screen changes are required — screens depend only on the interfaces.

## QR check-in token format

Defined in `src/services/qrToken.ts`. Colon-delimited, URL-safe:

```
971mma:v1:<source>:<memberId>
```

| Segment   | Example      | Meaning |
| --------- | ------------ | ------- |
| prefix    | `971mma`     | namespace; scanners ignore foreign codes |
| version   | `v1`         | schema version |
| source    | `supabase`   | `supabase` now, `mindbody` later |
| memberId  | `<uuid/id>`  | Supabase profile `id` now; Mindbody `ClientId` later |

- The token carries **only a member identifier** (no secrets).
- `resolveMemberByQrToken(token)` parses it (no network) and returns a
  `{ memberId, source }` ref. The Supabase provider accepts `source=supabase`;
  the Mindbody provider accepts `source=mindbody`.
- The member's "My Pass" QR in the Scan screen is generated with
  `buildMemberQrToken(userId, 'supabase')`. When migrating, regenerate passes
  with `source='mindbody'` and the Mindbody `ClientId`.

## Notes / not done yet

- Email-signup toggle could not be verified via MCP — confirm in the Supabase
  dashboard (Authentication → Providers → Email). See `BACKEND_SETUP.md`.
- Per-class booked **counts** are not readable under member-scoped RLS, so the
  schedule shows the member's own booked state (`isBooked`) plus a deterministic
  capacity fill for visual texture. A `class_booking_counts` view (service role)
  or an RPC can expose real counts later.

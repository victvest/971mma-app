# 971 MMA — Test Notes, Gaps & Shippability Findings

This file is the honest companion to the automated suite in `tests/`. The suite
proves the **backend behavior** of every major feature end-to-end against the live
project. This document records:

1. what the green suite does and does **not** prove,
2. intentionally-disabled / staff-only flows you should be aware of before launch,
3. external-dependency risks to verify against production,
4. genuine gaps and recommended manual checks before shipping to 1000 users.

> TL;DR for shipping: the **core money/attendance paths are solid and verified**
> (SALTO/member pass check-in → points, coach roll-call → points, member pass →
> coach scan, redeem → fulfil/cancel/refund, activation queue, admin access control), and the
> one intentionally staff-only flow to watch is guardian linking (§2a). The
> remaining items are *external-dependency confirmations* to close before launch.

---

## 1. What "all green" does and does not prove

**Proves (verified against the live Supabase backend — same RPCs/edge functions both
apps call):**

- Auth: real `auth-sign-in` path — valid login, bad-credential rejection without
  user enumeration, missing-field validation, and **admins blocked from the mobile
  app**.
- Gate access: SALTO/member pass access attempts, device allow-listing, same-day
  duplicate handling, and **+10 points on a real check-in**.
- Member pass + coach scan: pass issuance/expiry, coach scanner parse, single-use
  token (replay blocked), members can't consume scan tokens.
- Roll call: start → mark present (incl. scan) → complete → facility check-in →
  **points award**; absent members correctly earn nothing.
- Points engine: exact +10 credit, ledger integrity, streak math, and the
  **structural double-credit guard**.
- Redemption: redeem → pending → fulfil; cancel & refund **restore points**;
  insufficient-points / out-of-stock / tier-lock guard rails.
- Referrals, belt recompute, class subscriptions, notification prefs, support
  tickets, account-deletion requests.
- Admin: **access-control boundary** (members rejected from every privileged RPC),
  user search & role change, activation approval (activates the account),
  redemption refund + status guards, broadcasts, coach edits, content toggles,
  SALTO device/access visibility, deletion queue, support triage, health/reports,
  moderation listing.

**Does NOT prove (out of scope for a backend behavior suite — verify separately):**

- **On-device UI rendering / navigation.** This suite drives the backend, not React
  Native screens. Pair it with the existing Maestro flows in
  [`e2e/maestro/flows`](../e2e/maestro/flows) for on-device screen coverage, and do a
  manual pass on a physical iPhone before submission.
- **Real camera QR scanning.** We verify token issue/parse/validate logic; we do not
  drive a physical camera. Manually scan a member pass on a coach device.
- **Push notification delivery.** We verify fanout rows + recipient resolution; we do
  **not** assert APNs/FCM actually delivers to a handset. Send a real broadcast to a
  test device.
- **Email/SMTP delivery** for verification codes / password reset. Configured via
  `supabase/.env.local` SMTP_* — send a real signup and confirm the email arrives.
- **Mindbody write-back side effects** (real bookings/visits/arrivals in the MB
  console). See §3.

---

## 2. Intentionally disabled / staff-only flows (know before launch)

### 2a. Guardian / family child-linking is 100% staff-driven — **verify the app has no dead-end UI**

- `request_child_link` is a **disabled stub**: it unconditionally raises
  `STAFF_MANAGED_ONLY` ("Family trainee links are created by academy staff in the
  admin web app"), deprecated in migration `0054`. A member **cannot** add their
  child from the mobile app.
- The working path is staff-only: the admin panel creates links via the
  `guardian-approve` edge function (`action: 'create_direct'`) and approves them.
  Both the **blocked mobile path** and the **working staff path** are covered by the
  suite (mobile-app/guardians + admin/guardians).
- **ACTION before launch:** confirm the mobile app does **not** present a
  parent-facing "Add my child" button/form that would dead-end on
  `STAFF_MANAGED_ONLY`. If it does, either hide it or change the copy to "ask the
  front desk." Confirm front-desk staff know to create family links in the admin
  panel. This is the one place where a real user could hit a wall.

### 2c. Account activation is Mindbody-driven; the activation request is a staff queue

- `request_account_activation` files a queue item (status `pending`). An admin
  resolves it (`admin_update_activation_request`, valid statuses
  `pending | resolved | cancelled` — **not** "approved"). Resolving the queue item
  does **not** by itself flip the member to `active`.
- The member actually becomes `active` when staff **link them in Mindbody**
  (`mb-link-*` sets `account_status = 'active'`), which the linked-state test covers.
- **ACTION:** make sure front-desk SOP is "link the member in Mindbody, then resolve
  the activation request" — resolving alone won't unlock the app for them.

### 2d. `submit_referral` is server-only (not a defect)

- The app's referral feature uses `get_my_referral_code` + `apply_referral_code`
  (both granted to `authenticated`, both verified). `submit_referral` is granted to
  `service_role` only and is not called by the app — so it being un-callable by a
  member is expected, not a bug. Referral codes can only be applied by a member who
  is **not yet active** (`apply_referral_code` returns `ALREADY_ACTIVE` otherwise).

### 2b. Admin accounts cannot use the mobile app (by design)

- `auth-sign-in` rejects `role = 'admin'` even with the correct password (returns the
  generic `INVALID_CREDENTIALS` so it's indistinguishable from a bad login). This is
  a deliberate security control — admins use the web panel. Verified; no action.
  Operational note: do not hand a staff member an admin account and expect them to
  log into the phone app; give gym-floor staff a `coach` role instead.

---

## 3. External dependency: Mindbody (confirm against PRODUCTION before launch)

The suite **mocks the Mindbody client id** (per the testing brief) for deterministic
assertions, and additionally exercises the *real* manual-link endpoint with a bogus
id (it correctly returns `NOT_LINKED`, proving connectivity + structured errors).
What the suite cannot guarantee for you:

- **Production credentials.** `supabase/.env.local` currently holds the configured MB
  site/key. Confirm these are the **production** site, not a sandbox, before launch.
- **Auto-link-by-email** (`mb-link-auto`) for a real member whose email matches a
  real MB client — run this once with a real account.
- **"Not in Mindbody yet" UX.** A new signup with no MB match must get a clear
  "we couldn't find your membership / contact staff" experience, not a crash or an
  infinite spinner. Verify on device.
- **Coach class check-in write-back** (`mb-checkin`) records an arrival in Mindbody.
  Confirm `MB_WRITE_ARRIVALS` (or equivalent) is enabled in prod so coach scans
  actually post to MB, and that a member who isn't MB-linked degrades gracefully
  (the suite skips this branch when the test member isn't linked).

---

## 4. Testing-architecture notes (so you can re-run with confidence)

- **Live backend, shared admin session.** The `TEST_USER` is an admin account; the
  runner flips its role per scenario and restores it on exit. Tests run sequentially
  because of the shared session.
- **Self-cleaning & idempotent.** Every mutating test deletes what it created and
  restores balances/roles, so the suite is safe to re-run repeatedly (regression
  use). Multi-actor scenarios use **ephemeral throwaway users** (created via service
  role, deleted in teardown) — real members are never mutated.
- **Runtime.** A full run takes several minutes because each role flip is a real
  sign-out/sign-in and DB assertions shell out to the linked `supabase` CLI. This is
  fine for pre-release / nightly regression; it is not a per-commit unit suite.
- **SKIPs are surfaced, not swallowed.** A SKIP means a precondition wasn't present
  (e.g. the MB sandbox unreachable) — read them in `tests/output/REPORT.md` and
  decide whether they matter for your release.

---

## 5. Recommended pre-submission manual checklist (device)

These are the things a green backend suite cannot replace:

- [ ] Fresh install → sign up → email verification code arrives (SMTP) → onboarding.
- [ ] Member: open pass, have a coach scan it in a class; confirm points appear.
- [ ] Member: show the pass to the SALTO gate reader; confirm check-in + points + streak.
- [ ] Coach: run a roll call for a real class, mark present/absent, complete it.
- [ ] Member: redeem a reward; staff fulfils it in the admin panel.
- [ ] Push: send a broadcast from admin → confirm it arrives on a real device.
- [ ] Guardian: confirm the app has no broken "add child" self-service entry (§2a).
- [ ] Mindbody: link a real account by email; confirm membership shows (§3).
- [ ] Account deletion request from the app → appears in the admin deletion queue.

---

## 6. Automated suite results

See `tests/output/REPORT.md` (regenerated on every run) for the latest pass/fail/skip
breakdown per feature. Re-run with `npm run test:e2e` after any code change to catch
regressions.

_Latest full run summary is appended below by the maintainer after each run:_

<!-- RESULTS:START -->
Latest full run summary pending rerun after the community feature removal.
<!-- RESULTS:END -->

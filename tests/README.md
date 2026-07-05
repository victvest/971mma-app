# 971 MMA — End-to-End Regression Suite

Black-box, behavior-level tests that drive the **live linked Supabase backend**
(edge functions + RPCs + triggers) exactly the way the mobile app and admin panel
do. The goal: run this, see it green, and ship with confidence. Re-run it after any
change to catch regressions.

> These tests assert **product behavior** (a member earns points when they check
> in; an admin can refund a redemption; a member can't reach staff tooling), not
> implementation details. They exercise the same RPCs/edge functions both clients
> call, so green here means the shipped feature works.

## Layout

```
tests/
  run-all.mjs            # discovers + runs every *.test.mjs, writes output/REPORT.md
  lib/
    framework.mjs        # tiny sequential test framework + assertions
    harness.mjs          # wraps the proven e2e harness (role-flipping, ephemeral users, fixtures)
  mobile-app/
    auth/                # real auth-sign-in path: happy, bad creds, admin-blocked
    attendance-qr/       # member pass QR + coach scanning it (class check-in)
    gate-entry/          # gate tablet QR display + member self check-in + geofence/dup/forgery
    roll-call/           # coach roll call → present marks → facility check-in + points
    points-rewards/      # points engine: exact credit, ledger, streak, double-credit guard
    redemption/          # redeem → pending → fulfil/cancel + insufficient/out-of-stock/tier-lock
    mindbody/            # account linking (mocked client id) + manual-link contract + mb-health
    referrals/           # code issuance, submission, application (2nd actor), bad-code reject
    guardians/           # child-link request + unapproved link grants no proxy authority
    communities/         # channel listing + membership-gated visibility
    belt-progression/    # belt/rank recompute + member read access
    schedule/            # home dashboard + class subscribe/unsubscribe
    profile-support/     # notification prefs round-trip + support ticket + account-deletion request
  admin/
    access-control/      # require_admin boundary: members rejected, admins admitted
    users/               # search + role assignment
    activations/         # member requests → admin approves → account activated
    redemptions/         # admin refund restores points + status guards
    broadcasts/          # send broadcast → announcement persisted
    coaches/             # edit coach profile
    content/             # toggle rewards-catalog content
    gate-settings/       # set + validate gate exit PIN
    account-deletions/   # advance deletion request (non-destructive)
    support/             # resolve a member support message
    health-reports/      # system health + reports summary dashboards
    community-moderation/# moderation listing (admin-gated)
```

Why admin tests live in the app repo: the admin panel is a thin Next.js client over
the **same Supabase backend** (the `admin_*` RPCs). Testing those RPCs against the
live project is the highest-fidelity way to validate admin behavior, and it reuses
this one harness + Supabase link.

## Running

```bash
# from 971mma-app/
npm run test:e2e            # everything (mobile + admin)
npm run test:e2e:mobile     # mobile app only
npm run test:e2e:admin      # admin panel only
npm run test:e2e:list       # list cases without running

node tests/run-all.mjs --grep=redemption   # filter by name/suite/area
```

Reports are written to `tests/output/REPORT.md` (human) and `tests/output/latest.json`
(machine). The process exits non-zero if anything fails — wire it into CI as-is.

## How it works / prerequisites

- Reuses `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env`) and
  `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` (`supabase/.env.local`), plus the linked
  `supabase` CLI for admin SQL. No extra setup beyond what the repo already needs.
- The shared `TEST_USER` is an **admin** account; the runner flips its role
  (member ↔ coach ↔ gate ↔ admin) per scenario and restores it at the end. Because
  one session is shared, tests run **sequentially**.
- Multi-actor scenarios (coach scans a *different* member; referral applied by a
  friend; admin acts on a member) create **ephemeral throwaway users** via the
  service role and delete them in teardown — real members are never mutated.
- **Mindbody is external.** Per the brief, the Mindbody client id is mocked (link
  rows are seeded) for deterministic assertions; one resilient test hits the real
  manual-link endpoint and skips (not fails) if the MB sandbox is unreachable.
- Every mutating test cleans up after itself (deletes created rows, restores
  balances/roles), so the suite is **idempotent and safe to re-run**.

## Interpreting results

- **PASS** — behavior verified end to end against the live backend.
- **SKIP** — a precondition wasn't present (e.g. feature not seeded, MB sandbox
  down). Skips are surfaced, never silently swallowed.
- **FAIL** — a real behavioral defect. See `tests/output/REPORT.md` for the
  failing assertion + context.

See [`TEST-NOTES.md`](./TEST-NOTES.md) (in this folder) for known gaps,
intentionally-disabled flows, and shippability notes discovered while building
this suite.

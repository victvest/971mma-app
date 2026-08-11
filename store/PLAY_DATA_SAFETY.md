# Google Play — Data safety form (971 MMA)

Fill Play Console → App content → Data safety. Last audited: 22 July 2026.

## Privacy policy

`https://971mma.com/app-privacy/`

## Does your app collect or share user data?

**Yes** — collects.  
**Does not share** with third parties for advertising. Service providers (Supabase, Mindbody) process data on our behalf for app functionality.

## Account deletion

- Users can request deletion: **Yes**
- In-app: Profile → Delete Account (immediate)
- Web URL (required): `https://971mma.com/app-account-deletion/`

## Data types

| Category | Data | Collected | Shared | Mandatory? | Purposes | Ephemeral? |
|---|---|---|---|---|---|---|
| Personal info | Name | Yes | No* | Yes for account | App functionality, Account management | No |
| Personal info | Email | Yes | No* | Yes | App functionality, Account management | No |
| Personal info | User IDs | Yes | No* | Yes | App functionality, Account management | No |
| Personal info | Phone | Yes | No* | Optional | App functionality | No |
| Photos and videos | Photos | Yes | No* | Optional | App functionality (avatar) | No |
| App activity | App interactions | Yes | No* | Yes | App functionality | No |
| App info / performance | Crash logs | No (unless you add a crash SDK later) | — | — | — | — |
| Device or other IDs | — | No intentional | — | — | — | — |
| Location | — | **No** | — | — | — | — |
| Financial | — | **No** in app | — | — | — | — |
| Health / fitness | — | **No** sensor data | — | — | — | — |

\*Processors acting on our behalf (Supabase hosting, Mindbody sync) — declare per Play’s “Data processors” guidance; do **not** mark as sold or used for advertising.

## Security practices

- Data encrypted in transit: **Yes** (HTTPS / TLS)
- Users can request deletion: **Yes**
- Independent security review: No (unless you obtain one)

## Advertising ID

App does **not** use advertising ID. Declare accordingly.

## Permissions vs Data safety consistency

Manifest should only include:

- `CAMERA` (coach QR)
- `POST_NOTIFICATIONS` (optional reminders)
- Network

Must **not** include `RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` (blocked in config).

# App Store Connect — App Privacy labels (971 MMA)

Fill App Privacy to match the binary. Last audited: 22 July 2026.

## Privacy Policy URL

`https://971mma.com/app-privacy/` (must be live before submit)

## Data collection overview

| Data type | Collected? | Linked to identity? | Used for tracking? | Purposes |
|---|---|---|---|---|
| Email address | Yes | Yes | No | App functionality, Account management |
| Name | Yes | Yes | No | App functionality |
| Phone number | Yes (optional) | Yes | No | App functionality |
| Photos | Yes (optional avatar) | Yes | No | App functionality |
| Other user content (support messages) | Yes | Yes | No | Customer support |
| Product interaction (check-ins, bookings display) | Yes | Yes | No | App functionality |
| Customer support | Yes | Yes | No | Customer support |
| User ID | Yes | Yes | No | App functionality, Account management |
| Device ID | No intentional collection | — | — | — |
| Advertising data | **No** | — | — | — |
| Precise / Coarse location | **No** | — | — | — |
| Purchase history | No (billing outside app) | — | — | — |
| Health / fitness sensors | **No** | — | — | — |

## Tracking

- **Does this app track users?** → **No**
- No ATT prompt required (no IDFA / cross-app advertising SDKs)

## Third parties that process data on your behalf

Declare as “used to process data for us” (not sold):

- Supabase (auth + database hosting)
- Mindbody (membership / schedule sync via server)

## Notes for reviewers

Camera permission is coach-only QR scanning.  
Photo access uses the system picker for optional profile pictures only.

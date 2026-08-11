# How to get every important key (971 MMA)

Filled what was recoverable on this machine. Keys still blank in `.env` must be copied from dashboards (Supabase never returns Edge secret plaintext via CLI).

---

## Already filled (you can leave as-is)

| Key | Source |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Project + EAS |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase projects api-keys` |
| `SUPABASE_DB_PASSWORD` | Your existing local value |
| Mindbody API/source keys | Your existing local value (verified token works) |
| `MINDBODY_LOCATION_ID=1` | Mindbody Locations API (971 MMA Al Quoz) |
| `ACADEMY_LAT` / `ACADEMY_LNG` | Same Mindbody location coordinates |
| `GEOFENCE_RADIUS_M=100` | Project convention |
| `GATE_LOCATION_ID=971mma-al-quoz` | Project convention |
| `SALTO_API_BEARER_TOKEN` | `postman/971mma-salto-gate.local.postman_environment.json` |
| `SALTO_ALLOWED_DEVICE_IDS` | Production: `Right Entrance,Left Entrance` (Gantner); local may also include `GT7-ENTRY-01` for Postman UAT |
| `MB_WRITE_ARRIVALS` / `MB_ALLOW_*` | Production flags (true) |
| `GEMINI_MODEL` / `PERSONA_DAILY_LIMIT` | Defaults used by Edge code |
| `APPLE_TEAM_ID=U32VZCVKKD` | Apple Development identity on this Mac |
| SMTP + test user | Your existing local values |

---

## Still blank — how to get each

### 1. `QR_SIGNING_SECRET` (required for member QR / gate)
**Where:** [Supabase Dashboard](https://supabase.com/dashboard/project/nzbbpduwahcncyvyjusj/settings/functions) → Edge Functions → Secrets  
**Or:** whoever set it originally (password manager / runbook).  
**Cannot** be read back via `supabase secrets list` (digest only).  
**If lost:** generate a new long random string, set it, redeploy `qr-issue` + Salto functions — old QR codes stop working immediately.

```bash
openssl rand -hex 32
npx supabase secrets set QR_SIGNING_SECRET='paste-here' --project-ref nzbbpduwahcncyvyjusj
```

### 2. `GATE_SIGNING_SECRET` (legacy — unused)
Was for the old tablet gate QR (`gate-qr-issue` / `entry-checkin`), removed in migration 0112.
Facility entry is SALTO NexusOne + `QR_SIGNING_SECRET` member passes only. Safe to leave
set in Edge Secrets; do not wire new code to it.

### 3. `CRON_SECRET`
Edge Secrets. Used as `x-cron-secret` for cron edge functions (`membership-refresh-cron`, `gate-sync-jobs`, etc.).  
**If lost:** generate + set new value; update any cron jobs / Postman that send the header.

### 4. `GEMINI_API_KEY` (Persona AI)
**Where:** [Google AI Studio](https://aistudio.google.com/apikey) → Create API key  
Also already stored in Supabase Edge Secrets (digest only). Copy from AI Studio or from whoever created it, then paste into `.env` for local `functions serve`.

### 5. `MINDBODY_WEBHOOK_SECRET`
**Where:** Mindbody → Developer / Webhooks settings for your subscription, **or** the value you chose when registering the webhook URL  
`https://nzbbpduwahcncyvyjusj.supabase.co/functions/v1/mb-webhook`  
Also in Edge Secrets. Needed only if you verify webhook signatures locally.

### 6. `EXPO_PUSH_ACCESS_TOKEN` (optional but recommended for prod push)
**Where:** [Expo](https://expo.dev) → Account settings → Access tokens → Create  
Or: https://expo.dev/accounts/[account]/settings/access-tokens  
Set the same value in Supabase Edge Secrets as `EXPO_PUSH_ACCESS_TOKEN`.

### 7. `ASC_APP_ID` (App Store Connect numeric Apple ID)
**Where:** [App Store Connect](https://appstoreconnect.apple.com) → My Apps → **971 MMA** → App Information → **Apple ID** (numbers only)  
Create the app record first if it does not exist (bundle `com.victvest.ninemma`).

### 8. `EXPO_ASC_API_KEY_ID` / `EXPO_ASC_API_KEY_ISSUER_ID` / `.p8` file
**Where:** App Store Connect → Users and Access → Integrations → **App Store Connect API** → +  
Download `.p8` once → save as `store/AuthKey_XXXXXX.p8` (gitignored)  
Issuer ID is shown on that page; Key ID is on the key row.

### 9. `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` file
**Where:** Google Cloud Console → IAM → Service Accounts → Create key (JSON)  
Link that SA in Play Console → Setup → API access → grant release permission  
Save JSON to `store/google-service-account.json` (path already set).

### 10. Confirm `APPLE_TEAM_ID`
Filled with `U32VZCVKKD` from your Apple Development cert.  
If App Store builds use the **Mosab Aldarwish** Distribution team instead, switch to `XXQ62BB2U2`.  
Confirm: https://developer.apple.com/account → Membership details → Team ID  
Or: `eas credentials -p ios`

### 11. Native Google Sign-In (`EXPO_PUBLIC_GOOGLE_*`)
Needed for the system **account picker modal** (no browser).

**Where:** [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)

Create **three** OAuth client IDs (same GCP project):

| Type | What to set | Where it goes |
|---|---|---|
| **Web application** | Authorized redirect URI = Supabase callback (`https://nzbbpduwahcncyvyjusj.supabase.co/auth/v1/callback`) | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` + Client Secret → Supabase Google provider |
| **iOS** | Bundle ID `com.victvest.ninemma` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |
| **Android** | Package `com.victvest.ninemma` + SHA-1 (debug **and** release/EAS) | Google Cloud only (no env var) |

Debug SHA-1 (local):
```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
```

EAS release SHA-1: `eas credentials -p android` → copy SHA-1 fingerprints into the Android OAuth client.

**Supabase:** Dashboard → Authentication → Providers → Google → Enable  
Client IDs (comma-separated, **Web first**): `WEB_CLIENT_ID,IOS_CLIENT_ID,ANDROID_CLIENT_ID`  
Client Secret: from the **Web** client  
Turn **ON** “Skip nonce check” (required for native iOS)

Then rebuild a **dev/prod native client** (`eas build` / prebuild). Expo Go cannot show the Google account modal.

### 12. Edge secrets already in production (no `.env` paste needed for cloud)
These are **set** in Supabase already (CLI shows digests). You only need plaintext in `.env` for local `supabase functions serve` / debugging:
`QR_SIGNING_SECRET`, `GATE_SIGNING_SECRET`, `CRON_SECRET`, `GEMINI_API_KEY`, `SALTO_*`, Mindbody, etc.

View names only:
```bash
npx supabase secrets list --project-ref nzbbpduwahcncyvyjusj
```

---

## Quick copy tips

```bash
# Service role (already filled; refresh anytime)
npx supabase projects api-keys --project-ref nzbbpduwahcncyvyjusj

# Mindbody location check
npm run check:mindbody
```

# Store submission readiness — 971 MMA

Prepared: 22 July 2026  
Bundle / package (iOS + Android, must match): `com.victvest.ninemma`  
Verify anytime: `npm run verify:app-ids`  
EAS project: `d6726c41-9cf4-48f0-a76f-489ca58b017e`

This pack gets you to **signing + config + policy-ready**. Builds and screenshots are intentionally out of scope here.

---

## Critical blockers found (and status)

| Issue | Risk | Status |
|---|---|---|
| Account deletion was staff-queue only (“request”) | App Store 5.1.1(v) rejection | **Fixed** — in-app self-delete via `account-self-delete` (deployed) |
| `RECORD_AUDIO` from camera/image-picker defaults | Play dangerous-permission scrutiny | **Fixed** — plugins + blocked |
| Broad photo permissions / library prompts | Play Photo & Video policy | **Fixed** — system picker only + blocked READ_MEDIA* |
| `SYSTEM_ALERT_WINDOW` | Play “Deceptive Behavior” risk | **Fixed** — blocked |
| Live `https://971mma.com/privacy-policy/` does **not** show a real app privacy policy | App Store 5.1.1(i) / Play User Data | **You must publish** pages in `store/hosting/pages/` |
| `app.971mma.com` does not resolve in DNS | Universal Links / auth callback broken | **You must create DNS** (or change host) |
| Screenshot committed to git | Accidental leak noise | **Untracked** + gitignored |
| Sign in with Apple entitlement missing in config | iOS SIWA entitlement gap | **Fixed** — `usesAppleSignIn: true` |
| Privacy Manifest Required Reason APIs | ITMS-91053 | **Added** baseline reasons in `app.json` |
| Android upload keystore | Play signing | **Ready** — EAS keystore `E4Srl6v0Fw` configured |
| iOS distribution credentials | App Store signing | **Needs interactive** `eas credentials -p ios` (Apple login) |

---

## What you must do manually (cannot be done from this machine alone)

### 1. Publish legal URLs (HARD REQUIREMENT)

Upload these HTML files to WordPress/Hostinger so they are publicly reachable **without login**:

| File | Publish at |
|---|---|
| `store/hosting/pages/app-privacy.html` | `https://971mma.com/app-privacy/` |
| `store/hosting/pages/app-account-deletion.html` | `https://971mma.com/app-account-deletion/` |

Then verify in a private browser window:

```bash
curl -sI https://971mma.com/app-privacy/ | head
curl -sL https://971mma.com/app-privacy/ | rg -i "account deletion|personal data"
```

Use these URLs in:

- App Store Connect → App Privacy → Privacy Policy URL  
- App Store Connect → App Information → User Privacy Choices URL (use deletion page)  
- Google Play → Store listing → Privacy policy  
- Google Play → Data safety → “How users can request deletion” → deletion page URL  

**Do not** point stores at `/privacy-policy/` until that page is replaced with real app policy text (today it renders marketing homepage content).

### 2. DNS + deep links for `app.971mma.com`

Currently `app.971mma.com` does not resolve. Either:

- Create an A/CNAME for `app.971mma.com` pointing at your host, **or**
- Change `EXPO_PUBLIC_AUTH_CALLBACK_HOST` (EAS + local) to a host you control.

Then host:

- `store/hosting/.well-known/apple-app-site-association` at `https://app.971mma.com/.well-known/apple-app-site-association`  
  (no `.json` extension; `content-type: application/json`)  
  Replace `TEAMID` with your Apple Team ID.
- `store/hosting/.well-known/assetlinks.json` at `https://app.971mma.com/.well-known/assetlinks.json`  
  Replace SHA-256 with Play App Signing cert fingerprint after first upload.

Also add `https://app.971mma.com/auth/callback` to Supabase Auth → Redirect URLs.

### 3. Apple signing (EAS)

```bash
cd 971mma-app
eas credentials -p ios
```

Choose **production** profile and let EAS create/manage:

- Apple Distribution certificate  
- App Store provisioning profile  
- Prefer App Store Connect API key (Users and Access → Integrations → App Store Connect API)

Then fill `eas.json` → `submit.production.ios`:

- `ascAppId` = App Store Connect “Apple ID” (numeric) for the app  
- `appleTeamId` = 10-character Team ID  

Create the App Store Connect app record first with bundle id `com.victvest.ninemma`.

### 4. Google Play signing (EAS)

```bash
eas credentials -p android
```

Use **Google Play App Signing** (default). For submit automation:

1. Play Console → Setup → API access → create service account  
2. Grant Release permissions  
3. Download JSON key to `971mma-app/store/google-service-account.json` (gitignored)  
4. Keep `submit.production.android.track` as `internal` for first upload  

### 5. Deploy the new edge function

```bash
cd 971mma-app
npx supabase functions deploy account-self-delete --project-ref nzbbpduwahcncyvyjusj
```

Without this deploy, in-app deletion will fail in production.

### 6. App Review demo account

Create a real member account for reviewers (email/password) that:

- Can reach home / schedule / profile  
- Can open Delete Account (reviewers may test — use a disposable account)  
- Has optional class data so the app does not look empty (Guideline 2.1)

Put credentials in App Store Connect → App Review Information.  
Also add notes:

> Camera is used only by coaches to scan member QR passes.  
> Account deletion is under Profile → Delete Account and completes immediately.  
> Gym membership/billing is outside the app (Mindbody / front desk).

---

## App Store Connect checklist (fill exactly)

- [ ] Privacy Policy URL → `https://971mma.com/app-privacy/`
- [ ] Support URL → `https://971mma.com/` or a dedicated support page
- [ ] Marketing URL (optional) → `https://971mma.com/`
- [ ] Age rating questionnaire (honest answers for fitness / user-generated content if any)
- [ ] App Privacy “nutrition label” — use `store/APP_PRIVACY_LABELS.md`
- [ ] Export compliance → uses non-exempt encryption = **No** (already set in binary)
- [ ] Sign in with Apple capability enabled for App ID
- [ ] Content rights / ads / gambling declarations = none applicable
- [ ] Phased release recommended for first major update after launch

### Common 2026 rejection traps (this app)

1. Privacy URL missing / wrong content  
2. Account deletion not actually deleting  
3. Permission purpose strings mismatch  
4. Login required without demo credentials  
5. Broken deep links / crash on launch  
6. Privacy labels disagreeing with SDKs  

---

## Google Play Console checklist

- [ ] Create app with package `com.victvest.ninemma`
- [ ] Privacy policy URL → `https://971mma.com/app-privacy/`
- [ ] Data safety form — use `store/PLAY_DATA_SAFETY.md`
- [ ] Account deletion URL → `https://971mma.com/app-account-deletion/`
- [ ] Content rating questionnaire (IARC)
- [ ] Target audience / Families — **not** designed primarily for children (guardian feature ≠ Kids category)
- [ ] Advertising ID declaration → **No** (app does not use Ads SDK / AAID)
- [ ] Photo/video permissions declaration → **Not used** (blocked; system picker only)
- [ ] App category: Health & Fitness / Sports
- [ ] First release on **internal testing** track, then closed, then production staged rollout
- [ ] Target API: Expo SDK 56 / RN 0.85 meets current floor; plan bump before **31 Aug 2026** if Google requires API 36 for updates

---

## Build commands (when you are ready — not run in this prep)

```bash
# iOS App Store binary
eas build -p ios --profile production

# Android AAB for Play
eas build -p android --profile production

# Submit after stores + credentials are ready
eas submit -p ios --profile production --latest
eas submit -p android --profile production --latest
```

---

## Security posture (verified)

- Mindbody secrets stay in Edge Functions / Supabase secrets only  
- Client uses Supabase **anon** key only (RLS)  
- Auth tokens in SecureStore  
- Production EAS env has `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`  
- Demo / skip-activation flags forced `false` on production profile  
- QR token logging is `__DEV__`-only  

Do **not** commit `.env`, service account JSON, `.p8`, APKs, or AABs.

## Env / secrets (single file)

All local keys live in `971mma-app/.env` (see `.env.example`).  
`supabase/.env.local` is a **symlink** to that file so CLI/scripts keep working.

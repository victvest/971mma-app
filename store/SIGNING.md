# Signing setup commands

All IDs and key **paths** are documented in `971mma-app/.env` (section D).
Never commit `.p8`, `.jks`, `.keystore`, `credentials.json`, or `google-service-account.json`.

**App identity (must match App Store Connect + Play Console):**
- iOS bundle ID: `com.victvest.ninemma`
- Android package: `com.victvest.ninemma`

Run from `971mma-app/` while logged into EAS (`eas whoami`).

## Android (ready for AAB)

Upload keystore is already generated:

| File | Purpose |
|---|---|
| `store/android-upload.keystore` | Upload key (gitignored) |
| `store/android-signing.env` | Passwords (gitignored) |
| `credentials.json` | EAS local credentials (gitignored) |
| `store/ANDROID_SHA.md` | SHA-1 / SHA-256 for Google Cloud |

Production EAS profile uses `credentialsSource: "local"` + `buildType: "app-bundle"`.

### Build a signed AAB

```bash
eas build --platform android --profile production
```

Output is an `.aab` signed with the upload key → upload to Play Console (internal/closed/production).

### SHA fingerprints (Google Sign-In / App Links)

See **`store/ANDROID_SHA.md`**.

Quick print:

```bash
# Debug
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore \
  -storepass android -keypass android | rg 'SHA1:'

# Release / upload
set -a && source store/android-signing.env && set +a
keytool -list -v -alias "$ANDROID_KEY_ALIAS" -keystore "$ANDROID_KEYSTORE_PATH" \
  -storepass "$ANDROID_KEYSTORE_PASSWORD" -keypass "$ANDROID_KEY_PASSWORD" | rg 'SHA1:'
```

### Play Console

1. Create app with package `com.victvest.ninemma`
2. Enable **Play App Signing** (default on new apps)
3. Upload the AAB from EAS
4. Copy Play’s **App signing** SHA-1 from Play Console → App integrity → add to Google Cloud Android OAuth client too
5. Put service account JSON at `store/google-service-account.json` for `eas submit`

```bash
eas credentials -p android
```

## iOS

```bash
# Interactive — creates/selects Distribution cert + App Store profile
eas credentials -p ios
```

After App Store Connect app exists, fill in `.env`:

```bash
ASC_APP_ID=...          # numeric Apple ID from App Store Connect
APPLE_TEAM_ID=...       # 10-character Team ID
EXPO_ASC_API_KEY_PATH=./store/AuthKey_XXXXXX.p8
EXPO_ASC_API_KEY_ID=...
EXPO_ASC_API_KEY_ISSUER_ID=...
```

Then mirror `ASC_APP_ID` / `APPLE_TEAM_ID` into `eas.json` → `submit.production.ios`,
or export the `EXPO_ASC_*` vars before `eas submit`.

## Verify remote versions

```bash
eas build:version:get -p ios
eas build:version:get -p android
```

Production profile has `autoIncrement: true`.

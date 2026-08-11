# Android SHA fingerprints — `com.victvest.ninemma`

Paste these into **Google Cloud Console → Credentials → Android OAuth client**.

Create **two** Android clients (or one client with both SHA-1s if the UI allows):

| Build | SHA-1 | When used |
|---|---|---|
| **Debug** | `9D:BC:9F:B8:05:21:5B:BB:40:D7:2C:00:14:3A:07:C3:4A:52:F4:7D` | Local `expo run:android` / emulator |
| **Release / Upload** | `99:73:4F:FB:70:62:D1:5A:8D:23:48:48:31:B1:23:86:49:30:57:A9` | EAS production AAB → Play Store |

### SHA-256 (App Links / Play Console)

| Build | SHA-256 |
|---|---|
| **Debug** | `8C:A2:6C:70:B4:CD:91:20:A8:19:BD:84:B5:F5:DE:33:E5:B4:2B:08:E5:AE:6F:74:48:00:63:81:D7:B5:9E:6E` |
| **Release / Upload** | `A1:0E:A8:79:4C:1F:27:CB:8F:37:12:17:DB:D6:70:3B:03:CC:8F:C5:07:8D:2B:6D:BE:8B:07:E7:2C:4F:EB:0F` |

Package name: `com.victvest.ninemma`

### Notes

- Upload keystore lives at `store/android-upload.keystore` (gitignored). Passwords in `store/android-signing.env` (gitignored).
- EAS production uses **local** credentials via `credentials.json` (gitignored) → signed AAB ready for Play.
- After you enroll **Play App Signing**, Google may show a *different* **App signing** SHA-1 in Play Console. Add that one to Google Cloud too when it appears.
- Re-print anytime:

```bash
# Debug
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | rg 'SHA1:|SHA256:'

# Release
set -a && source store/android-signing.env && set +a
keytool -list -v -alias "$ANDROID_KEY_ALIAS" -keystore "$ANDROID_KEYSTORE_PATH" \
  -storepass "$ANDROID_KEYSTORE_PASSWORD" -keypass "$ANDROID_KEY_PASSWORD" | rg 'SHA1:|SHA256:'
```

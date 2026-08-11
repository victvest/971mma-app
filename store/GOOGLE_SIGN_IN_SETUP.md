# Google Sign-In setup (971 MMA)

Native account picker on iOS + Android. No browser.

**App IDs:**
- Bundle / package: `com.victvest.ninemma`  
  (Android segments can’t start with a digit, so not `com.victvest.971mma`)
- Supabase project: `nzbbpduwahcncyvyjusj`
- Supabase callback: `https://nzbbpduwahcncyvyjusj.supabase.co/auth/v1/callback`

You need **3** Google OAuth clients (Web + iOS + Android). Do them in order.

---

## 1. Create a Google Cloud project

1. Open https://console.cloud.google.com/
2. Top bar → project dropdown → **New Project**
3. Name: `971 MMA` → **Create**
4. Make sure that project is selected in the top bar

---

## 2. Configure the OAuth consent screen

1. Open https://console.cloud.google.com/auth/overview  
   (or: **APIs & Services** → **OAuth consent screen** / **Google Auth Platform**)
2. If asked to get started:
   - App name: `971 MMA`
   - User support email: your email
   - Audience: **External**
   - Developer contact: your email
3. Save / continue until you’re done
4. Under **Audience** (or Test users): add your own Gmail so you can sign in while the app is in Testing
5. Under **Data Access** / Scopes, keep the defaults (`email`, `profile`, `openid`)

---

## 3. Create the Web client (required)

1. Open https://console.cloud.google.com/auth/clients  
   (or: **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**)
2. Application type: **Web application**
3. Name: `971 MMA Web`
4. **Authorized redirect URIs** → Add:
   ```
   https://nzbbpduwahcncyvyjusj.supabase.co/auth/v1/callback
   ```
5. **Create**
6. Copy and save:
   - **Client ID** → this is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - **Client secret** → this goes in Supabase (not in the mobile `.env`)

---

## 4. Create the iOS client

1. Same page → **Create credentials** → **OAuth client ID**
2. Application type: **iOS**
3. Name: `971 MMA iOS`
4. Bundle ID: `com.victvest.ninemma`
5. **Create**
6. Copy **Client ID** → this is `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

---

## 5. Get your Android SHA-1 fingerprints

Ready-made values: **`store/ANDROID_SHA.md`**

| Build | SHA-1 |
|---|---|
| **Debug** | `9D:BC:9F:B8:05:21:5B:BB:40:D7:2C:00:14:3A:07:C3:4A:52:F4:7D` |
| **Release / Upload** | `99:73:4F:FB:70:62:D1:5A:8D:23:48:48:31:B1:23:86:49:30:57:A9` |

### Debug SHA-1 (local)

```bash
keytool -list -v -alias androiddebugkey \
  -keystore ~/.android/debug.keystore \
  -storepass android -keypass android
```

### Release / EAS SHA-1

Already generated — see `store/ANDROID_SHA.md`. Re-print:

```bash
set -a && source store/android-signing.env && set +a
keytool -list -v -alias "$ANDROID_KEY_ALIAS" -keystore "$ANDROID_KEYSTORE_PATH" \
  -storepass "$ANDROID_KEYSTORE_PASSWORD" -keypass "$ANDROID_KEY_PASSWORD"
```

Or: `eas credentials -p android`

---

## 6. Create the Android client

1. Google Cloud → **Create credentials** → **OAuth client ID**
2. Application type: **Android**
3. Name: `971 MMA Android`
4. Package name: `com.victvest.ninemma`
5. SHA-1: paste the debug SHA-1 from step 5
6. **Create**
7. Copy **Client ID** (you only need this for Supabase, not for `.env`)

> Tip: create a **second** Android client (same package, different SHA-1) when you have the EAS/release fingerprint. Or edit and add extra SHA-1s if the UI allows.

---

## 7. Turn on Google in Supabase

1. Open https://supabase.com/dashboard/project/nzbbpduwahcncyvyjusj/auth/providers
2. Click **Google** → enable it
3. **Client IDs** (comma-separated, **Web first**):
   ```
   WEB_CLIENT_ID,IOS_CLIENT_ID,ANDROID_CLIENT_ID
   ```
   Example shape:
   ```
   123-aaa.apps.googleusercontent.com,123-bbb.apps.googleusercontent.com,123-ccc.apps.googleusercontent.com
   ```
4. **Client Secret**: paste the **Web** client secret from step 3
5. Turn **ON** → **Skip nonce check** (needed for native iOS)
6. Save

---

## 8. Put values in `.env`

Edit `971mma-app/.env`:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=paste-web-client-id-here
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=paste-ios-client-id-here
```

Also set the same two keys in **Expo Dashboard → Project → Environment variables** (for EAS builds).

---

## 9. Rebuild the native app

Google’s account modal needs a **dev/prod build**. Expo Go will not work.

```bash
cd 971mma-app
npx expo prebuild --clean
npx expo run:android
# and/or
npx expo run:ios
```

Or with EAS:

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

---

## 10. Test

1. Open the app on a real device / emulator
2. Tap **Continue with Google**
3. You should see the system **Select an account** sheet (not a browser)
4. Pick an account → you should land signed in

---

## Checklist

- [ ] Google Cloud project created
- [ ] OAuth consent screen done + your Gmail as test user
- [ ] Web client + redirect URI
- [ ] iOS client (`com.victvest.ninemma`)
- [ ] Android client + SHA-1
- [ ] Supabase Google enabled (Web,iOS,Android + secret + skip nonce)
- [ ] `.env` has Web + iOS client IDs
- [ ] Native rebuild done
- [ ] Account picker shows in app

---

## If it fails

| What you see | Fix |
|---|---|
| “Google Sign-In is not configured” | Fill `EXPO_PUBLIC_GOOGLE_*` in `.env` and restart Metro / rebuild |
| Opens browser instead of modal | You’re on Expo Go or an old build — rebuild native |
| `DEVELOPER_ERROR` on Android | Wrong SHA-1 or wrong package name on the Android client |
| Works on Android, fails on iOS | Missing iOS client ID / missing rebuild after adding it / Skip nonce check off |
| Supabase rejects token | Web client ID not first in Supabase Client IDs, or wrong Client Secret |

Done when the Google account sheet appears and you get a session without leaving the app.

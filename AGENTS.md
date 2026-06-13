# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Cursor Cloud specific instructions

This is an Expo SDK 56 (React Native 0.85 / React 19 / TS) mobile app. There is a single
JS service: the Expo dev server (Metro). There is no separate backend in this repo — the
app talks to a hosted Supabase project; `src/config/env.ts` ships a public anon-key
fallback so it boots with no `.env`.

### Running (cloud has no device/emulator → use web)
- Start the dev server on the web target: `npx expo start --web --port 8081` (Metro serves
  at `http://localhost:8081`; the JS bundle is built lazily on first page/bundle request).
- The `web` target requires `react-dom`, `react-native-web`, and `@expo/metro-runtime`
  (already in `package.json`). `expo-font` is also required (peer dep of `@expo/vector-icons`).
- iOS/Android (`npm run ios|android`) won't work here without a simulator; web is the
  supported way to run/verify the UI in cloud.

### Lint / typecheck / build
- There is no ESLint config or `test` script. Use TypeScript as the check:
  `npx tsc --noEmit` (passes clean).
- Health check: `npx expo-doctor`. Two warnings are pre-existing/expected: app.json
  schema strictness on `newArchEnabled`/`splash`. Do not "fix" app config to silence them.
- To verify the app compiles, request the web bundle:
  `curl "http://localhost:8081/index.bundle?platform=web&dev=true&hot=false"` (expect HTTP 200).

### Auth / Supabase gotchas (important for end-to-end testing)
- The app is auth-gated: logged out shows Login/Signup; the tabs (Home/Scan/Classes/Profile)
  only appear after a logged-in session.
- The hosted Supabase project has **email confirmation enabled**, so `signUp` returns no
  session (the UI shows a "Confirm your email" dialog) and `signInWithPassword` on an
  unconfirmed account returns "Email not confirmed". Reaching the logged-in tabs therefore
  requires a **pre-confirmed** account (or disabling email confirmation in the Supabase
  dashboard / using a service-role key — neither is available from this repo).
- The project also enforces an **hourly email send rate limit**; repeated signups return
  HTTP 429 `over_email_send_rate_limit`. Space out signup attempts.
- Supabase email validation rejects `@example.com`; use a realistic domain (e.g. `@gmail.com`)
  for test signups.

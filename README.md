# 971 MMA

Mobile app for **971 MMA Academy** members and coaches — schedule, check-in, belt path, rewards, and coach tools.

Built with **Expo SDK 56**, **React Native 0.85**, and **Expo Router**. Backend is **Supabase** (auth, database, edge functions). Mindbody integration runs server-side only.

## Requirements

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator (Xcode) or Android Emulator, or Expo Go on a device

## Setup

```bash
npm install
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Get Supabase keys from **Project Settings → API** in the Supabase dashboard. Use only the **anon** key in the app — never the service role key.

## Project structure

| Path | Purpose |
|------|---------|
| `app/` | Expo Router screens and navigation |
| `src/features/` | Feature modules (home, schedule, check-in, coach, etc.) |
| `src/shared/` | Shared UI, theme, and utilities |
| `src/services/` | Supabase, Mindbody, and data layer |
| `supabase/` | Migrations and edge functions |
| `assets/` | Images, fonts, and media |

## Builds

Production and preview builds use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --profile production
```

Profiles are defined in `eas.json`.

## License

See [LICENSE](./LICENSE).

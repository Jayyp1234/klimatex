# KlimateX household app (mobile)

The native version of the web household app (`web/app/app/household/`). A family signs in with their phone and a 4-digit PIN and sees their home's real figures: grade, petrol saved, payouts, solar loan, certificate, readings and alerts, plus the **Ask KlimateX** assistant.

Expo SDK 58 · React Native · TypeScript · Expo Router.

## Run it

```bash
cd mobile
npm install
npx expo run:ios --port 8082     # development build in the iOS Simulator (first build takes a few minutes)
```

`expo run:ios` builds a development client, so voice input (`expo-speech-recognition`) works. After the first build, `npx expo start --port 8082` is enough. Port 8082 is used because 8081 is often taken by a `kubectl port-forward` on this machine; any free port works.

Expo Go also runs the app (`npx expo start`, then press `i`). Voice input needs the native module, so in Expo Go the mic button is hidden and families type instead. Read-aloud (`expo-speech`) works in both.

## Point it at live or local

The API base comes from `EXPO_PUBLIC_API_BASE` and defaults to the live server.

| Target | Command |
| --- | --- |
| Live, `https://team20.xtradot.co` (default) | `npx expo start --port 8082` |
| Local PHP API on this Mac | `EXPO_PUBLIC_API_BASE=http://localhost:8080 npx expo start --port 8082 --clear` |
| A phone on the same Wi-Fi, local API | `EXPO_PUBLIC_API_BASE=http://<your-mac-ip>:8080 npx expo start --clear` |

If port 8080 isn't running, any copy of `backend-php` in mock mode works: `php scripts/demo.php` seeds it, then `php -S 127.0.0.1:8091 -t public public/index.php`, and point `EXPO_PUBLIC_API_BASE` at that port. A session from one server is rejected by another, so switching servers signs you out (by design).

`--clear` matters when switching: `EXPO_PUBLIC_*` values are inlined at bundle time. In development builds, the sign-in screen shows which server the app is using. Local HTTP is allowed through `NSAllowsLocalNetworking`.

## Signing in

Demo homes follow the seed: home NN is phone `0700 001 00NN` (Adaeze is `0700 001 0012`).

1. First time: enter the phone, get a 6-digit code (no SMS is connected, so the sandbox code is shown on screen with a **Fill it in** button), then choose a PIN.
2. Afterwards: phone, then PIN.
3. **Forgot your PIN?** sends a new code, then you choose a new PIN.

## How it talks to the API

- Everything is in `src/lib/api.ts`. Responses are `{meta, data, error}`; screens show `error.message`.
- The session (access token, refresh token, user) is stored in the Keychain via `expo-secure-store`.
- Access tokens last 30 minutes. Refresh tokens are single-use and rotate, and the server revokes the session if one is replayed. So every 401 shares **one** refresh promise, as in `refreshSession()` on the web. If the refresh is refused, the app signs out; if the phone is offline, the session is kept.
- Development builds have **More › Language & preferences › Developer › Test token refresh**. It spoils the access token and reloads the dashboard (five calls), then reports how many refresh calls went out (expected: 1) and whether the refresh token rotated.
- The dashboard figures use the same arithmetic as `loadDashboard()` and `OverviewPage` on the web (`src/lib/household.ts`, `overviewFigures`).

### API v6 features

The assistant (`POST /api/assistant/ask`), the street card (`GET /api/homes/{id}/street`) and `source` on the monthly message come with API v6. On a server without them, the street card is hidden, and the assistant, street and message screens show "coming soon" instead of an error.

### API v7 features

`GET /api/homes/{id}/tips`, `GET /api/homes/{id}/evidence` and `POST /api/homes/mine/fuel-receipts` come with API v7. Earn more uses the server's tips when it has them (asked again each time the screen comes into view) and falls back to tips worked out in the app (`src/lib/tips.ts`) otherwise. Fuel receipts shows "coming soon" on a server without the endpoint.

## Screens

| Tab / screen | File |
| --- | --- |
| Sign-in (phone, code, PIN, forgot PIN) | `src/app/sign-in.tsx` |
| Home: grade, petrol saved, paid to you, next payment, clean energy, street card, 14-day chart, payouts, alerts | `src/app/(app)/(tabs)/index.tsx` |
| Energy: range, chart, KPIs → daily readings, monthly summary | `(tabs)/energy.tsx`, `readings.tsx`, `monthly.tsx` |
| Payouts: totals, history, receipts → credits & serials (with registry check) | `(tabs)/payouts.tsx`, `payout/[id].tsx`, `credits.tsx` |
| Ask KlimateX: chat, mic, read aloud, five languages | `(tabs)/ask.tsx`, `src/lib/voice.ts` |
| Earn more: tips worked out from the home's own audit checks and readings (backup generator share, missing days, low-output days, failed meter checks, generator proof, next grade) | `earn-more.tsx`, `src/lib/tips.ts` |
| Fuel receipts: the 12 months before solar, add or replace a month, plus meter and generator evidence (API v7) | `receipts.tsx` |
| How it's calculated: the working for any month (solar, generator cap, baseline, project emissions, leakage, credited, petrol) with its sources | `calculation.tsx` |
| More: notifications, certificate, loan, monthly message, street, profile, payment details, preferences, help, support, sign-out | `(tabs)/more.tsx` and the files beside it |

## Android APK

A release APK can be built locally, with no Expo account:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
cp app/build/outputs/apk/release/app-release.apk ../dist/klimatex.apk
```

- It points at the live server unless `EXPO_PUBLIC_API_BASE` is set when building.
- It is signed with the Android debug key that `expo prebuild` generates. That is fine for sharing a demo APK, but not for the Play Store, and a later build must be signed with the same key to install over it. `android/`, `dist/` and `*.keystore` are in `.gitignore`.
- It runs on Android 7 and later, on ARM phones (arm64-v8a and armeabi-v7a). First build takes about 10 minutes.

## Checks

```bash
npx tsc --noEmit
npx expo lint
```

Screenshots from the iOS Simulator are in `docs/screenshots/`.

## Known limits

- **Voice input** uses the phone's speech recogniser. iOS has no Nigerian English model, so English and Pidgin retry as `en-US`. Yorùbá, Igbo and Hausa usually aren't offered, and the app says so and lets the family type. In the Simulator, recognition often isn't available at all.
- **`pod install` and locale.** If `expo run:ios` fails in `pod install` with a Unicode error, run it with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- **A 502 from the proxy** (no `{meta, data, error}` body) shows "KlimateX is having trouble right now". Live `GET /api/homes/{id}/message` currently returns 502.

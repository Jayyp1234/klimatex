# KlimateX technical documentation

For an engineer joining the project. Read this first, then use the deeper documents it points to.

| If you want | Read |
|---|---|
| The whole system at engineer level | This document |
| The carbon maths, the nine checks, the money flow, the demo script | [`SYSTEM_GUIDE.md`](SYSTEM_GUIDE.md) |
| Backend setup and deploy commands | [`../backend-php/README.md`](../backend-php/README.md) |
| Mobile app setup, builds and limits | [`../mobile/README.md`](../mobile/README.md) |
| Every API call, ready to run in VS Code | [`api-requests.http`](api-requests.http) |
| What we learned about the bank sandbox | [`SANDBOX_SPEC_NOTES.md`](SANDBOX_SPEC_NOTES.md) |

Last updated: 11 November 2026.

---

## 1. What KlimateX is

KlimateX turns a Lagos household's switch from a petrol generator to solar into verified carbon credits, and pays the family their share. Solar output is read from the home's inverter every day. Each day is checked against what the sun allowed. An auditor signs off a period, credits are issued and listed, a company buys and retires them, and the family's share is paid to their Access Bank wallet, bank account or solar loan.

It was built for the Access Youth Tech Forge 2026 hackathon (team20). **All homes, people and readings are synthetic.**

### Who uses it

| Role | Signs in with | Where | Sees |
|---|---|---|---|
| `household` | Phone number and 4-digit PIN | Web `/app/household/`, mobile app | Their own home: grade, energy, payouts, loan, certificate, tips, assistant |
| `installer` | Work email and password | Web `/app/installer/` | Every home they fitted, audit status, homes needing attention |
| `auditor` | Work email and password | Web `/app/auditor/` | Periods, samples, evidence, sign-off, audit trail |
| `buyer` | Work email and password | Web `/app/marketplace/` | Credits to reserve, pay for and retire |
| `lender` | Work email and password | Web `/app/lender/` | Homes and solar loans by energy grade |
| `admin` | Work email and password | Web `/app/admin/` | Everything, plus operator endpoints |

---

## 2. The system at a glance

```
  Mobile app (Expo, React Native)        Web app (Next.js, static export)
  mobile/                                web/  ── built into ──▶ backend-php/public/
        │                                      │
        └────────────── HTTPS, JSON ───────────┘
                           │
                 Cloudflare (Access login on pages; /api/* is open)
                           │
        ┌──────────────────▼───────────────────┐
        │  PHP 8.3 API on Apache (one image)   │   backend-php/
        │  public/index.php → Kernel → routes  │
        │  also serves the built website       │
        └───────┬───────────────┬──────────────┘
                │               │
        Postgres (live)   Access sandbox, inside the cluster
        SQLite (laptop)   · bank API (wallets, transfers, loans, registry)
                          · Huawei MaaS (LLM)
```

Three things to hold on to:

1. **One backend, one image.** The PHP image serves both the API (`/api/*`, `/hooks/*`, `/healthz`) and the website (everything else, as static files from `public/`).
2. **The web app is a static export.** There is no Node server in production. `npm run publish:site` in `web/` builds the site and copies it into `backend-php/public/`.
3. **Clients never hold secrets.** The mobile and web apps only call the API. Bank keys, the JWT secret and any AI key live in Kubernetes secrets.

---

## 3. Repository map

| Path | What it is |
|---|---|
| `backend-php/` | The API. PHP 8.3, no framework. Also holds the Kubernetes manifests and the Dockerfile. |
| `backend-php/src/` | `Config`, `Controllers`, `Core`, `Middleware`, `Migrations`, `Models`, `Routes`, `Services` |
| `backend-php/public/` | `index.php` (the entry point) plus the built website, which is **not** in git |
| `backend-php/scripts/` | `migrate`, `demo`, `evidence`, `streets`, `fetch_nasa`, `create-user`, `sandbox`, `worker` |
| `backend-php/tests/` | PHPUnit: 18 test files, 98 tests |
| `backend-php/k8s/` | `app.yaml` (API and worker deployments, service) and `postgres.yaml` |
| `web/` | Next.js 16 app: landing page, household app, marketplace, auditor portal, fleet dashboards, street grades |
| `mobile/` | Expo SDK 58 app for households (iOS and Android) |
| `docs/` | This document, the system guide, pitch brief, sample certificate, API request collection |
| `brand/logo/` | Logo family |
| `START_HERE.md` | The original hackathon package cover note (older than this document) |

Not in the repository, on purpose: the team20 kubeconfig, any `.env`, `node_modules/`, `vendor/`, the generated `mobile/ios/` and `mobile/android/` projects, build output, the Android APK, and the organisers' sandbox guide PDF.

---

## 4. Technology

| Part | Stack |
|---|---|
| Backend | PHP 8.3, Apache, `nikic/fast-route`, `firebase/php-jwt`, `guzzlehttp/guzzle`, `vlucas/phpdotenv`, PHPUnit 11 |
| Database | PostgreSQL in the cluster, SQLite on a laptop (same migrations) |
| Web | Next.js 16.4 (static export, `trailingSlash: true`), React 19.3, Tailwind CSS 4, `lucide-react`, TypeScript 5 |
| Mobile | Expo SDK 58, React Native 0.88, React 19.3, Expo Router, TypeScript 6, `expo-secure-store`, `expo-speech`, `expo-speech-recognition`, `react-native-svg` |
| Hosting | Kubernetes namespace `team20`, image `ghcr.io/jayyp1234/klimatex-php:<tag>`, behind Cloudflare at `https://team20.xtradot.co` |

Two warnings that will save you time:

- **Next.js 16 and Expo SDK 58 both have breaking changes** from what most tutorials (and AI assistants) assume. `web/AGENTS.md` and `mobile/AGENTS.md` say where the current docs are. Read them before changing framework-level code.
- The web app's `/app/[workspace]` route is statically generated for each role; there is no server-side rendering anywhere.

---

## 5. Run it on a laptop

You need PHP 8.3+, Composer, Node 20+, and for the mobile app Xcode (iOS) or the Android SDK with JDK 17.

### 5.1 Backend (port 8080)

```bash
cd backend-php
composer install
cp .env.example .env          # set DEMO_PASSWORD to anything
php scripts/demo.php          # migrates, seeds 20 homes, runs audit → sale → payout
composer test                 # 98 tests
php -S 0.0.0.0:8080 -t public public/index.php
```

`MODE=mock` (the default) needs no network: the bank, registry and LLM are replaced by local stand-ins, and the AI falls back to ready-written answers. `php scripts/demo.php` only works on an empty database; delete the SQLite file named in `DB_DSN` to start again.

### 5.2 Web (port 3000)

```bash
cd web
npm install
npm run dev                   # talks to http://localhost:8080 in development
npm run lint
npm run publish:site          # build and copy into ../backend-php/public/
```

After `publish:site`, the PHP server on port 8080 serves the whole product, website included.

### 5.3 Mobile

```bash
cd mobile
npm install
npx expo run:ios --port 8082                                   # first build takes a few minutes
EXPO_PUBLIC_API_BASE=http://localhost:8080 npx expo start --port 8082 --clear   # point at the laptop API
```

Without `EXPO_PUBLIC_API_BASE` the app talks to the live server. See `mobile/README.md` for the Android APK build and the list of known limits.

### 5.4 Demo accounts

| Who | How to sign in |
|---|---|
| Household NN (01 to 20) | Phone `0700 001 00NN`. First time: a 6-digit code (shown on screen, because no SMS provider is connected), then choose a PIN. Adaeze is Home 12. |
| Staff | `admin@`, `auditor@`, `buyer@`, `installer@`, `lender@demo.klimatex.test` with the `DEMO_PASSWORD` you set |

The seed plants three homes with problems, so the checks have something to catch: Homes 04 and 19 have copied readings (held for review) and Home 17 reads higher than the sun allows (excluded).

---

## 6. Core concepts

Short definitions. The detail, with worked examples, is in `SYSTEM_GUIDE.md` sections 3 to 8.

| Term | Meaning |
|---|---|
| **Site / home** | One house with one inverter and one scrapped generator. `KX-0012` is site 12. |
| **Reading** | One day of inverter data: kWh generated, to the home, from grid, from backup generator. |
| **Sunlight ceiling** | The most a home's panels could make that day: NASA daily irradiance × panel kWp × 1.1. A day above it fails. |
| **Period** | An audit window (the demo uses Jan to Jun 2026). Created, computed, sampled, reviewed, signed off. |
| **Nine checks** | Sunlight, energy balance, clone, flat line, spike, missing data, identity, decommissioned, backup share. Code: `Services/Carbon/Checks.php`. |
| **Trust score** | 0 to 100 per home per period, from the checks. |
| **Status** | `eligible`, `held` (an auditor must look) or `excluded` (earns nothing this period). |
| **Grade A to G** | Share of the home's power still from a generator: A is 0 to 2%, G is over 75%. Code: `Services/Carbon/Grade.php`. |
| **Methodology** | Gold Standard JUST: Fossil Fuel Generators v1.0, Scenario B. Code: `Services/Carbon/JustV1.php` behind the `Methodology` interface, chosen by the `METHODOLOGY` setting. |
| **Credit** | One tonne, with a public serial such as `KX-NG-2026-LAG01-000001`. Listed, reserved, then retired in a buyer's name. |
| **Payout** | The household's 50% share of a sale, to a solar loan, wallet or bank account. Money is always whole kobo. |
| **Ledger** | An append-only, hash-chained log of every material event. `GET /api/ledger/verify` re-checks the chain. |
| **Evidence** | Fuel receipts for the 12 months before solar, and the meter's calibration. With 12 receipts the baseline is "measured"; without, it is "surveyed" and credits are cut (10% in the demo). |
| **Credit tips** | What a home can do to earn more, worked out from its checks and evidence. Code: `Services/Home/CreditTips.php`. |
| **Street grade** | The same A to G scale for a whole street, public at `/streets/`. |

---

## 7. Backend

### 7.1 Request lifecycle

1. Apache sends everything to `public/index.php`. A `GET` that is not `/api`, `/hooks` or `/healthz` is served as a static file from `public/` (the website).
2. `Core/Kernel.php` matches the route from `Routes/api.php`. Each route names a controller method and the roles allowed (`null` means public, `[]` means any signed-in user).
3. `Middleware/AuthMiddleware.php` checks the bearer token, the role, and for `/api/homes/{id}/…` that a household only reads its own home.
4. The controller calls a service in `Services/`; services use repositories in `Models/` and never build SQL in controllers.
5. Every response has the same envelope:

```json
{ "meta": { "request_id": "…", "status": 200, "success": true, "path": "…", "method": "GET", "duration_ms": 12 },
  "data": { },
  "error": null }
```

On failure `data` is null and `error.message` is a sentence written for the end user. Clients show it as it is.

### 7.2 Authentication

| Thing | Value |
|---|---|
| Access token | JWT, 30 minutes |
| Refresh token | 14 days, **single use**. Each refresh returns a new pair. |
| Replay | Using a refresh token twice revokes every session for that user. Clients must share one refresh between parallel requests (see 9.3 and 10.3). |
| Staff sign-in | `POST /api/auth/login` with email and password. Five failures in 15 minutes lock the account for that window. |
| Household sign-in | `phone/start` → (`code`) `phone/verify` → `phone/complete` with a PIN and name; afterwards `phone/start` → (`pin`) `phone/login`. |
| Codes | 6 digits, valid 10 minutes, 5 attempts, 5 codes per 15 minutes. Returned as `demo_code` while `SMS_PROVIDER=none`. |
| PIN | 4 digits. Repeats, runs and a short list of common PINs are refused. Five wrong PINs lock the phone for 15 minutes; a code resets it. |

Code: `Services/Auth/AuthService.php`, `PhoneAuthService.php`, `JwtService.php`.

### 7.3 Data model

Tables, by the migration that created them (`src/Migrations/`):

| Migration | Tables |
|---|---|
| M001 Core schema | `installers`, `households`, `sites`, `generators`, `inverters`, `readings`, `sunlight`, `periods`, `site_results`, `credits`, `orders`, `payouts`, `ledger`, `webhook_events`, `kv` |
| M002 Auth | `users`, `refresh_tokens`, `login_failures` |
| M003 Ledger and indexes | indexes and ledger constraints, no new tables |
| M004 Registry flow | registry columns on `periods`; payment and registry columns on `orders` |
| M005 Household access | `phone_codes`; phone and payout details on `households`; phone and PIN hash on `users` |
| M006 Support requests | `support_requests` |
| M007 Streets | `streets`; `street_id` on `sites` |
| M008 Evidence | `fuel_receipts`; meter accuracy and calibration date on `inverters` |

`schema_migrations` records what has run. Migrations run at container start (`php scripts/migrate.php`) and are safe to repeat. The relationships and columns are described in `SYSTEM_GUIDE.md` section 9.

### 7.4 Settings

Read in `Config/Settings.php` through `Env::get`. On a laptop they come from `backend-php/.env`; in the cluster from Kubernetes secrets and the manifest.

| Setting | Default | Notes |
|---|---|---|
| `MODE` | `mock` | `live` talks to the real sandbox |
| `DB_DSN`, `DB_USER`, `DB_PASS` | SQLite in the temp folder | Postgres in the cluster |
| `JWT_SECRET` | none | Secret. Required. |
| `DEMO_PASSWORD` | none | Secret. Password for the seeded staff logins. |
| `GATEWAY_KEY` | none | Secret. Injected by the sandbox for the bank and MaaS gateways. |
| `WEBHOOK_SECRET` | none | Secret. Returned once by `register-webhook`. |
| `BANK_BASE_URL` | in-cluster bank API | |
| `MAAS_BASE_URL`, `MAAS_MODEL` | in-cluster Huawei MaaS, `glm-5.2` | OpenAI-style chat completions |
| `METHODOLOGY` | `gs-just-v1` | Which `Methodology` implementation computes credits |
| `PUBLIC_BASE_URL` | `https://team20.xtradot.co` | Used in links and QR codes |
| `WEBHOOK_URL` | in-cluster service URL | Where the sandbox calls back |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | CORS for the web dev server |
| `SMS_PROVIDER` | `none` | `none` returns sign-in codes in the response for the demo |

Carbon constants (emission factors, adjustment, leakage, backup limit, price per credit) are constants in `Settings.php`. **The emission factors are placeholders** until confirmed from the methodology's annexes; see section 12.

### 7.5 The bank, the registry and mock mode

`Services/Bank/Bank.php` returns `MockBank` or `LiveBank` behind the `BankApi` interface, depending on `MODE`. The live client backs off on HTTP 429 (the sandbox allows the whole team 60 requests a minute) and never resends a transfer after a 504: it re-queries instead. `scripts/worker.php` finishes payouts, re-queries pending transfers and expires reservations; in the cluster it runs as its own deployment from the same image.

Some request bodies for the sandbox (wallet, checkout, registry, loan) were written from the guide's examples and are marked `TODO(spec)`. See `SANDBOX_SPEC_NOTES.md`.

### 7.6 The AI features

Two features use a language model. In both, the model only **writes**; it never decides credits or money.

**Ask KlimateX** (`POST /api/assistant/ask`, `Services/Ai/Assistant.php`):

- The model is given tools that read the signed-in home's records: `home_overview`, `audit_status`, `payouts`, `alerts`, `energy`, `credit_tips`, `loan` (`AssistantTools.php`). It cannot write anything.
- Provider order: **Huawei MaaS** in live mode, otherwise **guided answers** (`GuidedAnswers.php`): fixed answers built from the same tools.
- If the model call fails for any reason, it falls back to guided answers. The reply says which happened: `mode` is `model` or `guided`, and `sources` lists the tools used.
- Questions are limited to 500 characters and throttled per user, because every question can cost several model calls out of the shared 60 a minute. The question text is never logged.
- Languages: English, Pidgin, Yorùbá, Igbo, Hausa (`lang` = `en`, `pcm`, `yo`, `ig`, `ha`).

**Monthly message** (`GET /api/homes/{id}/message?lang=`): a short message with the home's grade, petrol avoided and payout status. `source` is `model` when the LLM wrote it and `template` when it fell back to `MessageTemplates.php`. Results are cached.

Model replies may contain light markdown (bold, bullets). Both clients render it: `web/components/household/RichText.tsx` and `mobile/src/components/RichText.tsx`.

The user-facing label is deliberately vendor-neutral ("Written by AI", "AI answer").

### 7.7 Scripts

| Script | Use |
|---|---|
| `migrate.php` | Apply outstanding migrations |
| `demo.php` | On an empty database: seed, audit, sell, pay, retire |
| `evidence.php` | Add demo meter calibrations and fuel receipts to seeded homes |
| `streets.php` | Put seeded homes on their streets |
| `fetch_nasa.php` | Download real daily sunlight from NASA POWER into `data/` |
| `create-user.php` | Create a staff login |
| `sandbox.php` | Operator commands inside the pod (check the bank, register the webhook) |
| `worker.php` | The background worker |

### 7.8 Tests

`composer test` runs PHPUnit (`tests/Unit`, `tests/Integration`) on SQLite. To run against Postgres set `TEST_DB_DSN`, `TEST_DB_USER` and `TEST_DB_PASS`.

---

## 8. API reference

Base URL: `https://team20.xtradot.co` live, `http://localhost:8080` on a laptop. Send `Authorization: Bearer <access_token>` on everything not marked public. Request and response examples for most routes are in `SYSTEM_GUIDE.md` section 10 and `api-requests.http`.

### System and operator

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/healthz` | public | Liveness and mode |
| GET | `/api/sandbox/check` | admin | Checks the bank sandbox answers |
| POST | `/api/sandbox/register-webhook` | admin | Registers our webhook; returns its secret once |
| POST | `/api/sim/seed` | admin | Seeds the 20 demo homes |
| POST | `/api/demo/run` | admin | Runs the whole demo story |

### Sign-in

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/auth/login` | public | Staff sign-in with email and password |
| POST | `/api/auth/refresh` | public | Swaps a refresh token for a new pair |
| POST | `/api/auth/logout` | public | Revokes a refresh token |
| GET | `/api/auth/me` | any signed-in user | The signed-in user |
| POST | `/api/auth/phone/start` | public | Household sign-in, step 1: says whether a PIN or a code is next |
| POST | `/api/auth/phone/verify` | public | Checks the 6-digit code; returns a setup token |
| POST | `/api/auth/phone/complete` | public | Sets the PIN and name; returns a session |
| POST | `/api/auth/phone/login` | public | Phone and PIN; returns a session |

### Household's own home

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/homes/mine/fuel-receipts` | household | Adds or replaces one month's fuel receipt |
| GET | `/api/homes/mine` | household | The signed-in household's site id |
| GET | `/api/homes/mine/payout-details` | household | Where the family is paid, and the bank list |
| POST | `/api/homes/mine/payout-details` | household | Saves wallet or bank as the payout method |
| POST | `/api/homes/mine/payout-details/check` | household | Name enquiry on a bank account; saves nothing |

### Homes

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/api/homes` | installer, auditor, lender, admin | List of homes |
| GET | `/api/homes/{id}` | the home's household, and staff | One home: site, household, generator, inverter, daily readings, period results |
| GET | `/api/homes/{id}/certificate` | the home's household, and staff | Home energy certificate: grades, credited tonnes, trust score, checks |
| GET | `/api/homes/{id}/message` | the home's household, and staff | Monthly message, `?lang=`; `source` is `model` or `template` |
| GET | `/api/homes/{id}/payouts` | the home's household, and staff | Payouts with credit serials, and the total paid |
| GET | `/api/homes/{id}/alerts` | the home's household, and staff | Alerts: no data, low output, held, payout |
| GET | `/api/homes/{id}/street` | the home's household, and staff | The home's street grade |
| GET | `/api/homes/{id}/tips` | the home's household, and staff | Credit tips for the home |
| GET | `/api/homes/{id}/evidence` | the home's household, and staff | Baseline tier, fuel receipts, meter accuracy, generator |
| POST | `/api/homes/{id}/meter` | installer, admin | Records a meter calibration |
| GET | `/api/tips` | installer, admin | Tips across the installer's homes |
| GET | `/api/fleet` | installer, lender, admin | Fleet overview for the dashboards |

### Audit

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/api/periods` | auditor, admin | Audit periods |
| GET | `/api/periods/{id}/trail` | auditor, admin | Audit trail for a period |
| POST | `/api/periods` | auditor, admin | Creates a period |
| GET | `/api/periods/{id}` | auditor, admin | One period with its results |
| POST | `/api/periods/{id}/compute` | auditor, admin | Runs the carbon maths and checks |
| POST | `/api/periods/{id}/sample` | auditor | Draws the audit sample, `?seed=` |
| POST | `/api/periods/{id}/sites/{site}/review` | auditor | Records the auditor's decision on a home |
| POST | `/api/periods/{id}/signoff` | auditor | Signs off; credits are issued and listed |

### Marketplace

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/api/credits` | public | Credits, filterable by status, vintage, location, authorisation |
| POST | `/api/orders` | buyer | Reserves credits (15 minutes) |
| GET | `/api/orders/{id}` | buyer, admin | One order |
| POST | `/api/orders/{id}/confirm` | buyer, admin | Verifies payment, retires credits, pays out |
| POST | `/api/orders/{id}/release` | buyer | Releases a reservation |
| POST | `/api/orders/{id}/simulate-payment` | buyer | Mock mode: marks the order paid |
| GET | `/api/market/overview` | buyer | Marketplace summary |
| GET | `/api/market/orders` | buyer | The buyer's orders |

### Assistant and support

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/assistant/ask` | household | Ask KlimateX: `{message, lang, history}` |
| GET | `/api/support/requests` | household, installer, admin | Support requests |
| POST | `/api/support/requests` | household | Opens a support request |

### Public and webhooks

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/api/verify/{serial}` | public | Public check of one credit serial |
| GET | `/api/ledger/verify` | public | Re-checks the ledger's hash chain |
| GET | `/api/streets` | public | Public street grades |
| POST | `/hooks/forge` | public | Sandbox webhooks (HMAC-checked in live mode) |

53 routes in all. The source of truth is `backend-php/src/Routes/api.php`.

---

## 9. Web app (`web/`)

### 9.1 Pages

| URL | What | Main component |
|---|---|---|
| `/` | Landing page, with the public credit check and the demo video | `app/page.tsx`, `components/VerifyCredit.tsx` |
| `/streets/` | Public street grades | `components/StreetBoard.tsx` |
| `/app/` | Sign-in: phone for families, `?as=work` for staff | `components/app/PhoneSignIn.tsx`, `SignInForm.tsx` |
| `/app/welcome/` | First-visit setup for a family | `components/household/WelcomeSetup.tsx` |
| `/app/household/…` | Household app: dashboard, assistant, messages, energy (overview, readings, monthly), payouts (history, credits), receipts, loan, certificate, notifications, settings (profile, payments, preferences), help, support | `components/household/` |
| `/app/marketplace/` | Buyer marketplace | `components/marketplace/MarketplaceApp.tsx` |
| `/app/auditor/` | Auditor portal | `components/workspace/AuditorPortal.tsx` |
| `/app/installer/`, `/app/lender/`, `/app/admin/` | Fleet dashboard in three variants | `components/workspace/FleetDashboard.tsx` |

`lib/workspaces.ts` maps each role to its workspace and landing URL. `lib/links.ts` holds every link that leaves the landing page; **keep the trailing slash** on `/app/` (without it Apache redirects, see section 13).

### 9.2 Data layer

`lib/api.ts` is the only place that calls `fetch`. Each area has a small typed module on top of it: `household.ts`, `assistant.ts`, `tips.ts`, `payout.ts`, `streets.ts`, `marketplace.ts`, `fleet.ts`, `audit.ts`. Components import types and functions from these, never raw JSON shapes.

`API_BASE` is `NEXT_PUBLIC_API_BASE` if set, `http://localhost:8080` in development, and empty in a production build (same origin as the API).

### 9.3 Session

The session (`access_token`, `refresh_token`, `user`) is kept in `sessionStorage` under `klimatex.session`, so it ends when the tab closes. On a 401, `refreshSession()` runs **one** shared refresh for all the requests that failed together, then each request retries once.

### 9.4 Build and publish

`npm run publish:site` runs `next build` (static export to `out/`) and copies it into `backend-php/public/`. The Docker image then contains the site. Always publish the site before building the image.

Large static files live in `web/public/`: the demo video in `demo/`, and `downloads/klimatex.apk`. **The APK is not in git** (48 MB build output). Build it (see `mobile/README.md`) or download it from the repository's releases, and place it at `web/public/downloads/klimatex.apk` before publishing the site.

---

## 10. Mobile app (`mobile/`)

### 10.1 Structure

```
mobile/src/
  app/                      Expo Router: every file is a screen
    _layout.tsx             Root: restores the session, guards sign-in vs app
    sign-in.tsx             Phone → code → PIN, and forgot PIN
    (app)/_layout.tsx       Loads the dashboard once; stack of screens
    (app)/(tabs)/           Home, Energy, Payouts, Ask, More
    (app)/*.tsx             readings, monthly, credits, loan, certificate, notifications,
                            message, street, earn-more, receipts, calculation, profile,
                            payment-details, preferences, help, support, held, payout/[id]
  lib/
    api.ts                  fetch wrapper, session in SecureStore, shared refresh
    household.ts            loadDashboard() and formatting; mirrors web/lib/household.ts
    extras.ts               assistant, street, payout details, support, tips, evidence
    tips.ts, use-earn-more.ts   "Earn more" tips: server first, worked out in the app as a fallback
    voice.ts                speech recognition (optional native module) and read-aloud
    auth-context.tsx, household-context.tsx, prefs.ts, network.ts
  components/               ui.tsx (the UI kit), EnergyChart, CodeInput, RichText, Logo, …
  theme.ts                  Brand colours, shared with web/app/globals.css
```

### 10.2 Rules the app follows

- **The dashboard is loaded once** after sign-in by `HouseholdProvider` (`/api/homes/mine`, then the home, certificate, payouts and alerts together) and shared by every screen. Pull to refresh reloads it.
- **Figures match the web.** `overviewFigures()` in `lib/household.ts` is the same arithmetic as `OverviewPage` on the web. If you change one, change both.
- **Newer endpoints degrade quietly.** If the server answers 404 for the assistant, street, tips or evidence, the app hides the card or shows "coming soon" (`notYetLive()` in `lib/extras.ts`).
- **Numbers and dates are formatted by hand**, not with `Intl`, so they look the same on every phone.

### 10.3 Session and token refresh

The session is stored in the iOS Keychain / Android Keystore through `expo-secure-store`. `api()` in `lib/api.ts`:

1. Sends the request with the access token.
2. On 401, calls `refreshSession()`. All requests that fail at the same moment share one promise, so the single-use refresh token is spent once.
3. Retries once with the new token. If the refresh is refused, the session is cleared and the app returns to sign-in. If the phone is offline, the session is kept.

Development builds have a check under More › Language & preferences › Developer: it spoils the access token, fires four calls at once and reports how many refresh calls went out (it should be 1).

### 10.4 Configuration and builds

| Thing | Value |
|---|---|
| API base | `EXPO_PUBLIC_API_BASE`, default `https://team20.xtradot.co`. Inlined at bundle time, so restart Metro with `--clear` after changing it. |
| App id | `co.xtradot.klimatex` (iOS and Android), scheme `klimatex://` |
| iOS | `npx expo run:ios`. Simulator tested; not yet run on a real iPhone. |
| Android | `expo prebuild` then `./gradlew assembleRelease` with JDK 17. Output is debug-signed; see `mobile/README.md`. |
| Native folders | `ios/` and `android/` are generated and not in git. Configure native behaviour in `app.json`. |

---

## 11. Environments and deployment

| | Laptop | Live |
|---|---|---|
| URL | `http://localhost:8080` | `https://team20.xtradot.co` |
| `MODE` | `mock` | `live` |
| Database | SQLite | Postgres in the cluster |
| Bank, registry | `MockBank` | Access sandbox |
| AI | Guided answers | Huawei MaaS |

Live runs in the Kubernetes namespace `team20`. You need the team20 kubeconfig (ask the team lead; it is never committed), `kubectl` 1.30+ and Docker.

Release steps, in short (the exact commands are in `backend-php/README.md` and `SYSTEM_GUIDE.md` section 14):

1. `cd web && npm run publish:site`
2. Build and push the image for **linux/amd64**, with a new tag: `ghcr.io/jayyp1234/klimatex-php:vN`. Never use `:latest`.
3. Set the same tag on both deployments in `backend-php/k8s/app.yaml` (`app` and the worker) and `kubectl apply -f` it.
4. Migrations run when the container starts.
5. Check `/healthz`, sign in, and run through the demo.

Notes:

- `k8s/app.yaml` in the repository may show an older image tag than the one running. Check with `kubectl -n team20 get deploy app -o jsonpath='{.spec.template.spec.containers[0].image}'` before you deploy.
- Secrets are in `klimatex-secrets` and `klimatex-db`. Add a new one with `kubectl patch secret`, and pass it through in `docker/apache.conf` (`PassEnv`), or PHP will not see it.
- The site sits behind Cloudflare Access. The organisers opened `/api/*` so the mobile app can reach it. Cloudflare rejects some default HTTP clients (Python's `urllib` user agent gets 403); `curl` and the apps are fine.
- The bank sandbox allows 60 requests a minute for the whole team. Do not loop over the API.

---

## 12. What is real, what is simulated, what is open

Be straight about this in any demo or document.

| Area | State |
|---|---|
| Carbon maths, checks, trust score, grade, ledger, idempotent payouts | Built and tested |
| Household, marketplace, auditor and fleet dashboards; mobile app | Built; mobile tested on the iOS Simulator and an Android emulator only |
| Inverter readings | **Simulated** (`INV-SIM-…`). There is no route yet for a real inverter to send readings. |
| Sunlight | A daily series for Surulere in `backend-php/data/sunlight_surulere_2026.json`. Regenerate it from NASA POWER with `scripts/fetch_nasa.php`; without the file the simulator uses a placeholder. |
| Emission factors, adjustment, leakage rate | **Placeholders** until confirmed from the Gold Standard JUST annexes |
| Auditor | A team member in the demo ("Demo Auditor"), not an independent verifier |
| Registry and credits | Sandbox mock; every credit is flagged `simulated` |
| Compliance market | Not built. Credits have an `authorised` flag, always off. |
| Payments | Sandbox; some request bodies are best guesses (`TODO(spec)`) |
| SMS and WhatsApp | Not connected. Codes are shown on screen; the monthly message is a preview. |
| Voice input on mobile | Wired up; not verified on a real device. iOS has no Nigerian English recogniser, so English retries as `en-US`. |
| Android APK | Signed with a debug key. Fine for a demo download, not for the Play Store. |

---

## 13. Things that have already cost us time

| Symptom | Cause and fix |
|---|---|
| "Sign in" on the landing page went to `http://…:8080/app/` | `/app` without the slash made Apache redirect with its internal port. Fixed with `/app/` links and `ServerName`/`UseCanonicalName` in `docker/apache.conf`. Keep trailing slashes. |
| A new secret has no effect | It is missing from `PassEnv` in `docker/apache.conf`. |
| 502 from Cloudflare on the monthly message | The LLM call timed out behind the proxy. The clients show a retry. |
| Signed out after switching the mobile app between servers | A session from one server is refused by another. Expected. |
| `expo run:ios` fails in `pod install` with a Unicode error | Run with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`. |
| Metro will not start on 8081 | A `kubectl port-forward` often holds it. Use `--port 8082`. |
| TypeScript says a new mobile route does not exist | Typed routes are generated by Metro. Start `npx expo start` once, then re-run `npx tsc --noEmit`. |
| Android build: "Unable to locate a Java Runtime" | Set `JAVA_HOME` to a JDK 17 and `ANDROID_HOME` to the SDK. |
| `php scripts/demo.php` fails with "dates overlap" | The database is already seeded. Delete the SQLite file or use a fresh database. |
| Web and mobile show different figures | `OverviewPage` (web) and `overviewFigures()` (mobile) have drifted. They must use the same arithmetic. |

---

## 14. Working on the code

- **Checks before you push:** `composer test` in `backend-php/`; `npm run lint` in `web/`; `npx tsc --noEmit` and `npx expo lint` in `mobile/`.
- **Money** is always whole kobo in the backend and whole naira in API responses named `…_naira`.
- **Errors** are sentences for the end user. Write them that way in the backend; clients show `error.message` unchanged.
- **Words on screen** are plain: "home", "paid", "held". Keep engineering terms out of the family-facing apps.
- **A new household feature** usually touches four places: a route and service in the backend, a function in `web/lib/`, the same function in `mobile/src/lib/`, and a screen in each client. Make newer endpoints optional on the client until they are deployed.
- **Never commit** the kubeconfig, `.env` files, keystores or API keys. The `.gitignore` files cover the known ones; check `git status` before every commit anyway.

---

## 15. Where to look

| Question | File |
|---|---|
| Which roles may call a route? | `backend-php/src/Routes/api.php` |
| How is a month's credit computed? | `backend-php/src/Services/Carbon/JustV1.php`, `Carbon.php` |
| What does each check test? | `backend-php/src/Services/Carbon/Checks.php` |
| How does a period move from created to signed off? | `backend-php/src/Services/Period/PeriodService.php` |
| How is a sale split and paid? | `backend-php/src/Services/Market/MarketService.php`, `PayoutService.php` |
| What does the home endpoint return? | `backend-php/src/Services/Home/HomeService.php` |
| How are tips decided? | `backend-php/src/Services/Home/CreditTips.php`, `Services/Evidence/EvidenceService.php` |
| How is the demo data made? | `backend-php/src/Services/Simulator/Simulator.php`, `DemoService.php` |
| Where does the web keep its session? | `web/lib/api.ts` |
| Where is the household dashboard on the web? | `web/components/household/pages.tsx`, `HouseholdShell.tsx` |
| Where is the household dashboard on mobile? | `mobile/src/app/(app)/(tabs)/index.tsx` |
| Where are the brand colours? | `web/app/globals.css`, `mobile/src/theme.ts` |

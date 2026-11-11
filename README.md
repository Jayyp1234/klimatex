# KlimateX

KlimateX turns a Lagos household's switch from a petrol generator to solar into verified carbon credits, and pays the family their share, often straight into an Access Bank solar loan.

Built for the Access Youth Tech Forge 2026 hackathon (team20). Live demo: https://team20.xtradot.co. **All homes, people and readings are synthetic.**

## Start here

**[docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md)** is the full technical documentation: architecture, how to run each part, the API reference, the web and mobile apps, deployment, and what is real versus simulated.

| Document | What it covers |
|---|---|
| [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) | Everything an engineer needs, in one place |
| [docs/SYSTEM_GUIDE.md](docs/SYSTEM_GUIDE.md) | The carbon maths, the nine checks, money flow, data model, demo script |
| [backend-php/README.md](backend-php/README.md) | Backend setup and deploy commands |
| [mobile/README.md](mobile/README.md) | Mobile app setup, iOS and Android builds, known limits |
| [docs/api-requests.http](docs/api-requests.http) | Every API call, ready to run in VS Code (REST Client) |
| [docs/SANDBOX_SPEC_NOTES.md](docs/SANDBOX_SPEC_NOTES.md) | Notes on the bank sandbox |
| [docs/KlimateX_Pitch_Brief.pdf](docs/KlimateX_Pitch_Brief.pdf) | The pitch brief |

## What is in the repository

| Folder | What | Stack |
|---|---|---|
| `backend-php/` | The API, the worker, Kubernetes manifests | PHP 8.3, Postgres or SQLite |
| `web/` | Landing page and every dashboard | Next.js 16, React 19, Tailwind 4 |
| `mobile/` | The household app for iOS and Android | Expo SDK 58, React Native |
| `docs/` | Documentation and the pitch material | |
| `brand/` | The logo family | |

## The dashboards

| Dashboard | For | Where |
|---|---|---|
| Household | Families | `/app/household/` and the mobile app |
| Credit marketplace | Companies buying credits | `/app/marketplace/` |
| Auditor portal | Auditors | `/app/auditor/` |
| Installer | Solar installers | `/app/installer/` |
| Lender | Access Bank | `/app/lender/` |
| Operations console | KlimateX | `/app/admin/` |
| Street grades | Everyone | `/streets/` |

## Five-minute start

```bash
# 1. The API, on http://localhost:8080 (mock mode: no network needed)
cd backend-php
composer install
cp .env.example .env            # set DEMO_PASSWORD to anything
php scripts/demo.php            # seeds 20 homes and runs audit → sale → payout
composer test
php -S 0.0.0.0:8080 -t public public/index.php

# 2. The website, on http://localhost:3000
cd ../web
npm install
npm run dev

# 3. The mobile app, against the laptop API
cd ../mobile
npm install
EXPO_PUBLIC_API_BASE=http://localhost:8080 npx expo run:ios --port 8082
```

Sign in as a family with phone `0700 001 0012` (Adaeze, Home 12): the sign-in code is shown on screen. Sign in as staff with `admin@`, `auditor@`, `buyer@`, `installer@` or `lender@demo.klimatex.test` and your `DEMO_PASSWORD`.

## Not in this repository

- **Secrets:** the team20 kubeconfig, `.env` files, keystores and API keys. Ask the team lead.
- **Build output:** the built website in `backend-php/public/` (run `npm run publish:site` in `web/`), and the generated `mobile/ios/` and `mobile/android/` projects.
- **The Android APK:** build it with the steps in `mobile/README.md`, or download it from this repository's Releases page, then place it at `web/public/downloads/klimatex.apk` before publishing the site.
- **The organisers' sandbox guide:** it is theirs to share.

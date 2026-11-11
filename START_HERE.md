# KlimateX · Access Youth Tech Forge 2026 · Team KlimateX (team20)

Everything we have built, in one place.

| Open this | What it is |
|---|---|
| `docs/KlimateX_System_Guide.pdf` | **Start here.** How the whole system works, end to end: the journey of a home, the carbon maths, the nine checks, credits, money flow, ledger, data model, every API route with real sample responses, connecting to Access's sandbox, deploying to team20, the stage demo, troubleshooting, glossary |
| `docs/SYSTEM_GUIDE.md` | The same guide as Markdown (reads well on GitHub) |
| `docs/KlimateX_Pitch_Brief.pdf` | The 11-page pitch brief |
| `docs/api-requests.http` | Every API call in demo order, ready to click in VS Code (REST Client) |
| `backend-php/` | **The backend.** PHP 8.3, no framework. `composer test` runs the full suite |
| `web/` | The landing page in Next.js. `npm run publish:site` builds it into `backend-php/public/` |
| `brand/logo/` | The KlimateX logo family: layouts, colourways, app icons and concepts |

## Five-minute check on a laptop

```bash
cd backend-php
composer install
cp .env.example .env
php scripts/demo.php
composer test
php -S 0.0.0.0:8080 -t public public/index.php
```

## Going live

Follow section 14 of the System Guide (or `backend-php/README.md`). You need the team20
kubeconfig (kept private, not included here), kubectl 1.30+, Docker and a container registry.

## Still to confirm before the live run

1. Wallet, checkout, carbon registry and loan request bodies, marked `TODO(spec)` in `backend-php/src/Clients.php`
2. Real NASA POWER sunlight: `php backend-php/scripts/fetch_nasa.php`
3. Emission factors (1.59 and 0.40 t/MWh, 5% adjustment) from the JUST annexes

Not included on purpose: the team20 kubeconfig and any keys. Never commit them.

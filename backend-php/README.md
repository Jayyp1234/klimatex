# KlimateX backend (PHP) · Access Youth Tech Forge 2026 · team20

PHP 8.3 with Composer (FastRoute, JWT, phpdotenv). One app container, one worker and one
Postgres database, deployed into our `team20` namespace and published at
**https://team20.xtradot.co**. The landing page is built from `../web` and served at `/` from
this same container; everything under `/api`, `/hooks` and `/healthz` stays the API. The APK
calls the same address.

```
Phone APK ──internet──▶ team20.xtradot.co ──▶ this backend ──inside their cluster──▶ bank, carbon registry, Huawei AI
Laptop browser ───────▶ team20.xtradot.co/app ──▶ website files in public/app (same container)
```

## Layout

| Path | What it holds |
|---|---|
| `public/index.php` | Entry point: serves the website, then hands everything else to the Kernel |
| `src/Core` | `Kernel` (routing, CORS, error mapping), `Request`, `Response`, `HttpException` |
| `src/Routes/api.php` | Every route and who may call it, in one table |
| `src/Middleware` | Token checks, role checks, and per-home ownership checks |
| `src/Controllers` | Thin HTTP handlers |
| `src/Services` | Business logic: carbon engine, periods, market, payouts, ledger, webhooks, bank clients |
| `src/Models` | Repositories: all SQL lives here |
| `src/Migrations` | Versioned schema changes, applied once at container start |
| `scripts/` | `migrate.php`, `worker.php`, `create-user.php`, `demo.php`, `fetch_nasa.php` |
| `tests/` | PHPUnit: unit and in-process integration, including a real concurrency race |

All responses use one envelope: `{ meta, data, error }`.

## Run it on a laptop (no sandbox needed)

```bash
composer install
cp .env.example .env      # then set DEMO_PASSWORD
php scripts/demo.php      # migrates, seeds 20 homes, runs the whole story
composer test
php -S 0.0.0.0:8080 -t public public/index.php
```

Sign in at `POST /api/auth/login` with `admin@`, `auditor@`, `buyer@`, `installer@`, `lender@` or `adaeze@demo.klimatex.test` and your `DEMO_PASSWORD`. Households sign in by phone: seeded Home NN is `0700 001 00NN` (Adaeze is `0700 001 0012`). To run the tests against Postgres, set `TEST_DB_DSN`, `TEST_DB_USER` and `TEST_DB_PASS`.

## Deploy to team20 (from your machine: kubectl 1.30+, Docker)

```bash
export KUBECONFIG=~/forge/team20.yaml          # keep it private, never commit it
kubectl get pods                               # "No resources found" = connected

# 1. Secrets (once)
kubectl create secret generic klimatex-db --from-literal=POSTGRES_PASSWORD='<strong-password>'
kubectl create secret generic klimatex-secrets \
  --from-literal=DB_DSN='pgsql:host=postgres;port=5432;dbname=klimatex' \
  --from-literal=DB_USER='klimatex' --from-literal=DB_PASS='<strong-password>' \
  --from-literal=WEBHOOK_SECRET='pending' \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=DEMO_PASSWORD='<password-for-demo-logins>'

# 2. Database
kubectl apply -f k8s/postgres.yaml && kubectl rollout status deployment/postgres

# 3. Website, then image (Apple Silicon needs --platform)
(cd ../web && npm ci && npm run publish:site)   # copies the built site into public/
docker build --platform linux/amd64 -t ghcr.io/<you>/klimatex-php:v1 .
docker push ghcr.io/<you>/klimatex-php:v1

# 4. App (edit the image line in k8s/app.yaml first)
kubectl apply -f k8s/app.yaml && kubectl rollout status deployment/app
curl https://team20.xtradot.co/healthz                     # {"ok":true,"mode":"live",...}

# 5. Prove the bank answers, register the webhook, store its secret
kubectl exec deploy/app -- php scripts/sandbox.php check
kubectl exec deploy/app -- php scripts/sandbox.php register-webhook     # copy webhook_secret
kubectl patch secret klimatex-secrets -p '{"stringData":{"WEBHOOK_SECRET":"<secret>"}}'
kubectl rollout restart deployment/app deployment/worker

# 6. The demo against the real sandbox (creates the demo logins too)
kubectl exec deploy/app -- php scripts/demo.php
```

Updates: `kubectl set image deployment/app app=ghcr.io/<you>/klimatex-php:v2` (and the same for `deployment/worker worker=`). Undo:
`kubectl rollout undo deployment/app`. Logs: `kubectl logs deploy/app -f`.

## Main routes (see `src/Routes/api.php` for the access of each)

| Route | For |
|---|---|
| `POST /api/auth/login`, `/refresh`, `/logout` · `GET /api/auth/me` | Email sign-in for companies and staff |
| `POST /api/auth/phone/start`, `/verify`, `/complete`, `/login` | Household sign-in: phone and 4-digit PIN. The first time (or a forgotten PIN), a 6-digit code proves the phone. The installer registers the phone, so unknown numbers are refused. No SMS provider is connected (`SMS_PROVIDER=none`), so the code is returned as `demo_code` |
| `GET`, `POST /api/homes/mine/payout-details` · `POST …/check` | Where a family is paid: its Access wallet or a bank account. The bank confirms the account name before it's saved |
| `GET /api/homes`, `/api/homes/{id}`, `/api/homes/{id}/certificate`, `/api/homes/{id}/message?lang=pcm` | Household app |
| `POST /api/periods`, `/compute`, `/sample?seed=42`, `/sites/{id}/review`, `/signoff` · `GET /api/periods/{id}` | Auditor portal |
| `GET /api/credits` · `POST /api/orders` · `POST /api/orders/{id}/confirm` · `GET /api/orders/{id}` | Buyer marketplace |
| `GET /api/verify/{serial}` · `GET /api/ledger/verify` | Public verify page |
| `POST /hooks/forge` | Sandbox webhooks (HMAC-checked in live mode) |

## What is real and what is a guess

| Part | Status |
|---|---|
| Carbon maths, nine checks, trust score, grade, ledger, idempotent payouts | Done and tested on SQLite and Postgres |
| Interbank transfer, name enquiry, requery on 504, webhook HMAC | Follow the guide's own examples |
| Wallet, checkout, carbon registry, loan request bodies | **Best guesses, marked `TODO(spec)` in `src/Clients.php`**. Confirm against the *Sandbox API Mock Specification v2* |
| Sunlight | Placeholder; run `php scripts/fetch_nasa.php` for real NASA POWER data |
| Emission factors 1.59 / 0.40 t/MWh, 5% adjustment | Placeholders until confirmed from the JUST annexes |

Rules kept from the guide: synthetic data only; 60 requests a minute shared (the client backs off
on 429); never resend a transfer after a 504; Postgres is our record if the sandbox resets.

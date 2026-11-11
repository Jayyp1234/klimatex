# Sandbox spec notes (read before touching any bank, registry or payout code)

Written 9 Nov 2026 from three sources:

1. **Sandbox API Mock Specification v2, Participant Edition** (9 Nov 2026), the API contract. Saved locally at `~/Downloads/Forge-2026-Sandbox-API-Specification-v2-Participant-Edition.pdf`.
2. **Organisers' email**, sent with the spec.
3. **Onboarding call recording** (`~/Downloads/NEW RECORDING.mp4`, 57 min). The slides are captured below. The spoken part is **not transcribed yet**.

**Precedence:** section 5.8 of the *updated* Platform Guide beats the spec. The guide in this repo is v1.0 and has no section 5.8, so ask the organisers for the updated guide. To report a mismatch, send them the request and its `request_id`.

---

## 0. Status: option 1 implemented (9 Nov, late)

The team chose **decision 5A, option 1**: buyers pay the registry merchant `mer_900`, the registry retires the credits and pays the project owner, and KlimateX pays the 50/15/20/15 split from the operating account `0123456790`. Live probes by the API CHECKUP session confirmed the request formats below. All 46 tests pass on SQLite and Postgres.

| Row in section 4 | Status |
|---|---|
| 1 Checkout | Fixed: `merchant_id` `mer_900`, `currency`, `customer{name,email}`, `channels`, `metadata.order_id` |
| 2 Card | Fixed: nested `card{...}`, then OTP |
| 3 Verify | Fixed: needs `status` successful **and** `amount_paid` ≥ amount; the result is stored as `orders.payment_status` |
| 4 Wallets | Fixed: `owner_name`, `phone`. No holding wallet any more |
| 5 Wallet fund | Fixed: this is now the family payout, `source_account` `0123456790` |
| 6 Wallet transfer | No longer used |
| 7 Interbank | Fixed: `currency` added; `session_id` and fees are kept in `bank_response` |
| 8, 9 Loans | Fixed: `applicant_account` `0123456789`, BVN 22200000001, ₦500,000, 12 months; empty accept and disburse bodies; repayment from `0123456790`. Only Adaeze (Home 12) has a loan |
| 10 Double payment | Fixed: a loan home is paid **through the loan only**. If the bank refuses the repayment, the same money goes to the wallet instead, never both |
| 11 to 14 Registry | Fixed: project `type: solar_replacing_diesel` with owner Arewa `0123987005`; MRV sends metered kWh; admin `verified`; `GET /carbon/mrv/{id}` gives the batch; retire quotes `credit_batch_id` and the buyer's `payment_reference` |
| 15 Kobo triggers | Fixed: every pot and every family share is whole naira (largest-remainder split) |
| 16 Retry-After | Fixed |
| 17 request_id | Fixed: logged on every bank error |
| 18 Mock fees | Fixed: ₦10 / ₦25 / ₦50 + VAT + stamp duty |

**Decision B, how it's handled:** we never list more credits than the registry issued. For the demo period the registry issues **8 credits** (15,976 kWh × 0.53 = 8.47 t), and our JUST estimate of 18.309 t is kept as `methodology_t` next to it. Each order must come from one period, because the registry retires one batch per payment.

**New demo numbers** (they replace "18 credits, 10 sold, ₦150,000"):
- 8 credits issued and all 8 sold, for **₦120,000**.
- Split: families ₦60,000 across 17 homes · installer ₦18,000 · audit ₦24,000 · KlimateX ₦18,000.
- Adaeze receives **₦3,424, paid off her loan**.
- The registry keeps 2% and pays 98% of the sale to Arewa by NIP; that's recorded in the ledger as `registry.owner_payout`.
- The System Guide and Pitch Brief still show the old numbers.

**New order fields for the marketplace** (`GET /api/market/orders`, `GET /api/orders/{id}`): `certificate` (the registry `retirement_id`), `certificate_url`, `serial_range` (the registry batch range), `payment_status`.

**Proven live (10 Nov, image v4):** the whole flow ran on the real sandbox.
- Checkout to `mer_900` paid ₦120,000, with a ₦1,800 merchant fee.
- Registry: project `prj_118`, MRV `mrv_552` verified, batch `crb_0450`, 8 credits, retirement `ret_208`.
- The installer's NIP transfer was pending, then paid through the webhook.
- Order 1 **settled** with 20 of 20 payouts paid. A confirm replay caused no double pay (balances were identical before and after).
- Ledger intact with 35 entries.
- Three bugs from the v3 run are fixed in v4:
  - Wallet funding replies have no `status`.
  - The loan repayment's `status` is the loan's status, not the payment's.
  - The worker replayed pending payouts every 15 s. It now waits at least 5 minutes.

**Live cluster (owned by the API CHECKUP session):**
- Image v2 is deployed in live mode with real NASA sunlight. v3 carries everything above.
- Postgres runs on **emptyDir** because the platform's volumes fail with a billing error, so **the database is wiped whenever the Postgres pod restarts**.
- A duplicate webhook `whk_43dfa707` is still registered and causes harmless 401s in the logs. Deleting it needs the user's approval.

## 1. Event facts (from the onboarding slides)

| When | What |
|---|---|
| Mon 9 to Wed 11 Nov | Build days, virtual. Mentor sessions Tue 10 Nov, 1:30 to 3:30 PM |
| **Wed 11 Nov, 12:00 PM** | **Stage 2 demo** |
| Thu 12 Nov, by 10:00 AM | Finalists announced |
| Fri 13 Nov, 1:00 to 5:00 PM | Demo Day, top 10 teams |

- **Field:** 20 teams moved on, out of 357. ₦10,000,000 prize pool, seed funding for selected ideas, US$25,000 acceleration support for the top 10.
- **Our track:** 02, Sustainability and Climate-Linked Finance ("Turning Climate Action into Revenue": measuring and verifying emissions, issuing and tracking carbon credits, connecting verified projects with buyers).
- **What they expect:** a working demo that runs (not just slides), a real problem and user, and a link to the track that shows how a user would use it *and how the bank benefits*.
- **Judging (100):** Innovation 20 · Technical quality 20 · Bank fit 15 · Business model 15 · Impact 15 · Presentation 10 · Time 5 (keep to "5 + 5 + 5 minutes").
- **Help:** Telegram (announcements, questions, tech support, mentorship), email africafintech@accessbankplc.com, support team: Olugbenga Awotundun.

## 2. From the email (these override older assumptions)

- The bank is **Xtradot Bank**, CBN 044, NIP 000014.
- Every transfer response has **`fee`, `vat` and `stamp_duty`**, and `total_debit` includes all three. `GET /tariff` returns the active schedule. **Read charges from the response; never hard-code them.**
- **Merchant onboarding and KYC tiering are not built and return 404**, even though the spec documents them. Don't use them.
- **Bulk transfers**, `POST /transfers/bulk`:
  - Up to 200 items, intrabank and NIP mixed.
  - Each item needs a `name_enquiry_ref`, or set `auto_name_enquiry: true` with `expected_names_check` set to `strict`, `loose` or `none`.
  - The source account must cover **every accepted item plus charges**, or the **whole batch fails with INSUFFICIENT_FUNDS and nothing is debited**.
  - Rejected items carry `error_code`: one of NAME_MISMATCH, ACCOUNT_NOT_FOUND, ACCOUNT_DORMANT, BENEFICIARY_FROZEN, LIMIT_EXCEEDED, BANK_UNAVAILABLE, DUPLICATE_REQUEST, INVALID_REQUEST.
  - NIP items settle about 5 seconds after acceptance. Poll `GET /transfers/bulk/{batch_reference}` or listen for `transfer.bulk.completed`.
- **Idempotency-Key is required.** On a TIMEOUT for any transfer, **requery before retrying, never resend.**

## 3. Sandbox rules every caller must follow

- **Envelope:** `{status, message, data, meta, request_id}`; errors are `{status:"error", error:{code, message, field?}, request_id}`. Log `request_id`, because support needs it. You can send `x-request-id` and it is echoed back.
- **Idempotency:**
  - The `Idempotency-Key` is kept 24 hours; UUID v4 is recommended.
  - Same key and same body replays the original response (header `Idempotent-Replayed: true`).
  - Same key with a different body returns **409 DUPLICATE_REQUEST**, and so does reusing a `reference` or a `name_enquiry_ref`. **Every money call needs a fresh, unique `reference` on each genuine new attempt.**
- **Rate limit:** 60 requests a minute per team, shared with Huawei MaaS. A 429 comes with a `Retry-After` header, which we should honour.
- **Transfers are always two steps:** name enquiry, then the transfer quoting its `name_enquiry_ref`.
  - The ref lasts 10 minutes and works once. After that you get NAME_ENQUIRY_EXPIRED (expired) or DUPLICATE_REQUEST (reused).
  - The destination must match the enquiry, or you get NAME_ENQUIRY_MISMATCH.
  - An Xtradot-to-Xtradot payment must use `/transfers/intra`; sending it through `/interbank` returns INVALID_REQUEST.
- **Settlement timing:**
  - Interbank returns **202 `pending`**, then `transfer.successful` (or `.failed` / `.reversed`) after about 5 seconds.
  - Intrabank returns 201 and completes inside the call.
  - Status: `GET /transfers/{reference}`, or TSQ: `POST /transfers/interbank/requery {session_id}`.
- **NIP fees, charged to the source account on top of the amount:** up to ₦5,000 is ₦10 + VAT; ₦5,000.01 to ₦50,000 is ₦25 + VAT; above that, ₦50 + VAT (VAT 7.5%). Plus `stamp_duty` per the email.
- **KYC limits (single / daily):** tier 1 ₦50k / ₦300k · tier 2 ₦100k / ₦500k · tier 3 ₦5m / ₦25m · corporate ₦10m / ₦100m.
- **Webhooks:**
  - Signature is HMAC-SHA256 of `"{timestamp}.{raw_body}"`, sent as `x-forge-signature: sha256=...`.
  - Reject deliveries more than 5 minutes old, and answer 2xx within 10 seconds.
  - Failed deliveries retry at 1m, 5m, 15m, 1h and 6h. `event_id` is stable across retries.
  - The body carries `event`, `event_id`, `attempt` and `data.{reference,status,...}`.
- **Merchant fees on collections:** card is 1.5% capped at ₦2,000; transfer, USSD and QR are ₦50 flat. `verify` returns `amount_paid`, `merchant_fee` and `settlement_amount`.

### Trigger values: these are a live-demo trap

The sandbox **forces outcomes from the amount's last two kobo digits**, on *any* payment:

| Amount ends | Outcome |
|---|---|
| **.01** | INSUFFICIENT_FUNDS |
| **.02** | TIMEOUT, then failed and reversed after 30 s |
| **.03** | pending for 2 minutes, then successful |
| **.04** | interbank: successful, then reversed after 60 s |
| **.05** | webhook not delivered on first try |
| .00 and everything else | normal |

Other triggers:

| Trigger | Outcome |
|---|---|
| Reference starting `DUP-` | DUPLICATE_REQUEST |
| Account `0000000001` | ACCOUNT_NOT_FOUND |
| Account `0000000002` | Name enquiry times out after 10 s |
| Account `0987654399` | ACCOUNT_DORMANT |
| Account `0123987098` | BENEFICIARY_FROZEN |
| Bank code `999999` | BANK_UNAVAILABLE |
| BVN `22299999999` | Declined |
| Card ending 0016 / 0024 | INSUFFICIENT_FUNDS / INVALID_OTP |
| Header `x-test-outcome: successful\|failed\|pending\|timeout\|reversed` | Forces that outcome on any endpoint |

### Test data we use

- **Team accounts:**
  - `0123456789` Adaeze Chiamaka Okonkwo, tier 3, BVN 22200000001. This matches our demo household.
  - `0123456790` Babatunde Olumide Adeyemi, current, ₦5m. Our operating account.
  - `0123456793` Mama Nkechi Provisions Ltd, corporate, ₦12m. Our buyer.
- **Carbon payout beneficiaries:** `0123987005` Arewa Solar Co-operative Society (Zenith 000015); `0123987006` Ogoja Community Forest Trust.
- **Merchants and their settlement accounts:** `mer_204` Mama Nkechi → 0123456793 · `mer_205` Kano Agro Hub → 0123456791 · `mer_206` Ọ̀ṣun Threads → 0123456790 · `mer_900` Forge Carbon Registry.
- **Test card:** 5399 8300 0000 0008, CVV 123, PIN 1234, OTP 123456.

## 4. Where our code disagrees with the spec

The live request bodies are in `backend-php/src/Services/Bank/LiveBank.php` and `src/Services/Registry/Registry.php`. **Every row below will fail or misbehave against the real sandbox until fixed. Mock mode and tests don't see any of them.**

| # | Call | We send | Spec wants | Severity |
|---|---|---|---|---|
| 1 | `POST /payments/checkout` | amount, reference, description, callback_url | **`merchant_id` (required)**, `currency`, `customer{name,email,phone}`, `channels`, `metadata` | Blocks every sale |
| 2 | `POST /payments/{ref}/card` | flat `card_number`, `expiry: "12/30"`, cvv, pin | `{card:{number, expiry_month, expiry_year, cvv, pin}}`; it returns `otp_required`, then the OTP call | Blocks the demo's auto-pay |
| 3 | `GET /payments/{ref}/verify` | We check only `status == successful` | Also check **`amount_paid` ≥ amount**. A short payment returns `payment.partial` and stays pending | Correctness |
| 4 | `POST /wallets` | `name`, `reference` | `owner_name`, `phone`, `bvn`, `reference`. Returns `wallet_id`, tier 1, **max_balance ₦300,000** | Blocks seeding. The holding wallet can't take repeated ₦150k sales |
| 5 | `POST /wallets/{id}/fund` | amount, reference | "Fund a wallet **from a team account**": needs a source account. Not a free mint | Money model |
| 6 | `POST /wallets/transfer` | no narration | Add `narration` | Minor |
| 7 | `POST /transfers/interbank` | no `currency` | Add `"currency": "NGN"`; read `fee`, `vat`, `stamp_duty`, `total_debit`, `session_id` | Minor; store `session_id` for TSQ |
| 8 | `POST /loans/applications` | `applicant_name`, `account_number`, bvn, amount **₦1,500,000** | `applicant_account`, `bvn`, `amount`, `tenor_months`, `purpose`, optional `consent_id`. **Above ₦1,000,000 is `referred`, not approved.** The offer is capped at 1.4 × average monthly credits, so expect `approved_reduced` | Blocks Adaeze's loan |
| 9 | `POST /loans/{id}/repayments` | amount, reference | `source_account`, amount, reference: **repays from a team account** | Blocks the repayment |
| 10 | Household with a loan (`PayoutService::payHousehold`) | Wallet transfer **and then** loan repayment of the same amount | In live mode that pays the family twice, once into the wallet and once into the loan from another account. Pay the loan directly from the operating account instead | **Double payment in live** |
| 11 | `POST /carbon/projects` | name, methodology, country, location string, reference | `name`, `type: "solar_replacing_diesel"`, `location{state,lga,lat,lng}`, `owner{name, contact_name, phone, payout_account, bank_code}`, `methodology`. Registration runs a name enquiry on the payout account | Blocks sign-off |
| 12 | `POST /carbon/projects/{id}/mrv` | period_start, period_end, tco2e, evidence | `period{from,to}`, `metric: "energy_generated_kwh"`, `value` in kWh, `evidence_url`, `sensor_ids`. **The registry computes tonnes itself at 0.53 tCO2e/MWh** (see decision B) | Blocks sign-off |
| 13 | `POST /carbon/mrv/{id}/review` | `decision: "approve"` | `decision: "verified"` or `"rejected"` (with `reason`), or wait 60 s for auto-verify | Blocks sign-off |
| 14 | `POST /carbon/credits/retire` | project_id, quantity, beneficiary, serials, reference | `credit_batch_id` (from `GET /carbon/mrv/{id}`), `quantity`, `buyer{name,email}`, `price_per_credit`, `currency`, **`payment_reference` of a checkout paid to `mer_900`**, `retirement_reason`. Returns `retirement_id` and `certificate_url`; the registry keeps 2% and **pays the rest to the project owner by NIP** | Blocks retirement; money model |
| 15 | Household payout amounts (`PayoutService::householdShares`) | Arbitrary kobo, e.g. ₦4,322.18 | Kobo endings .01 to .05 hit the triggers above. **Round each share to whole naira** and give the leftover kobo to the KlimateX pot | **Random live failures** |
| 16 | 429 handling (`LiveBank::req`) | Fixed 2/4/6 s back-off | Honour `Retry-After` | Minor |
| 17 | Errors (`BankError`) | `request_id` not kept | Keep `request_id` for support tickets | Minor |
| 18 | MockBank NIP fee | ≤₦5k → ₦25, else ₦50 | ₦10 / ₦25 / ₦50 tiers + VAT + stamp duty | Mock realism only |

**Fine already:**
- Name-enquiry body, interbank fields, the requery path and "never resend" (the email confirms it).
- Webhook signature format, the 5-minute window and de-duplication on `event_id`.
- `x-api-key` and the `data` unwrapping.

## 5. Decisions the team needs to make

**A. Where the buyer's money actually goes.** In the spec, a carbon sale means the buyer pays the **registry merchant `mer_900`**, retirement quotes that payment, and the registry pays **98% to the project owner's account** (Arewa Solar, `0123987005`, an external Zenith account we can't spend from). That doesn't fund our family split. Options:

1. **Follow the spec's registry flow** (pay `mer_900`, retire, owner payout). Then pay the 50/15/20/15 split **from the team operating account `0123456790`**, recorded in our ledger as the mirror of the owner payout. This shows real registry retirement and real payouts.
2. **Sell through a team-settled merchant** (`mer_206` settles into `0123456790`; run `/admin/settlements/run` for the demo), pay out from that account, and treat registry retirement separately. This is simpler money, but the retirement then has no registry payment to quote.

Recommendation: option 1. It's the flow the organisers designed and will judge.

**B. Tonnes don't match the registry.** Our engine credits **18.225 t** using JUST factors (generator 1.59 t/MWh). The registry converts kWh at **0.53 t/MWh** and will issue roughly a third as many credits for the same kWh. Don't fudge the kWh to force a match. Instead, show both on stage, with the registry's count as what's issued in the sandbox and ours as the methodology estimate, or ask the organisers for a factor or metric override.

**C. The holding wallet.** A tier 1 wallet maxes out at ₦300,000. Either keep sale money in the operating account and not a wallet, or pay families from the operating account directly (bulk transfer to bank accounts isn't possible because the families have only wallets).

**D. Bulk payouts.** `/transfers/bulk` pays bank accounts, not wallets. It would save rate-limit budget (one call, not 17), but only if families had accounts. For the demo, keep wallet transfers and stay under 60 calls a minute.

## 6. Useful for the demo and for testing

- **Prove the "never resend" rule live:** pay one payout of an amount ending **.02**. You'll see TIMEOUT, our requery, then failed and reversed, with no double debit. The organisers said this is judged.
- **Admin tools:**
  - `x-test-outcome: timeout` forces any path.
  - `POST /admin/reset` restores the opening state.
  - `POST /webhooks/test` sends a signed sample.
  - `GET /webhooks/deliveries` shows our webhook's status codes.
  - `POST /admin/settlements/run` settles merchants immediately.
  - `POST /admin/accounts/{n}/fund` tops up a team account, up to ₦50m.
- `POST /payments/{ref}/simulate-transfer` completes a checkout without a card, which is handy if the card flow misbehaves on stage.

## 7. Still open

- **Section 5.8 of the updated Platform Guide.** We don't have it. Get it from the organisers, because it overrides the spec.
- **The onboarding call's speech.** The slides are covered above. Transcribing the remaining ~40 minutes (Huawei MaaS walkthrough, platform guide walkthrough, Q&A) needs a speech model downloaded to this Mac.

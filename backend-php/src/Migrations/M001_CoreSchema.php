<?php

namespace App\Migrations;

/** household -> site -> inverter -> reading -> period -> credit -> order -> payout */
final class M001_CoreSchema
{
    public static function up(bool $sqlite): array
    {
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        $f = 'DOUBLE PRECISION';
        $big = $sqlite ? 'INTEGER' : 'BIGINT';
        return [
            "CREATE TABLE kv (key VARCHAR(120) PRIMARY KEY, value TEXT NOT NULL)",
            "CREATE TABLE installers (id $id, name VARCHAR(120) NOT NULL, accreditation_id VARCHAR(40),
                account_number VARCHAR(20) NOT NULL, bank_code VARCHAR(10) NOT NULL)",
            "CREATE TABLE households (id $id, name VARCHAR(120) NOT NULL, wallet_id VARCHAR(64),
                consent_hash VARCHAR(64), loan_id VARCHAR(64))",
            "CREATE TABLE sites (id $id, label VARCHAR(20) UNIQUE NOT NULL, household_id INTEGER NOT NULL REFERENCES households(id),
                installer_id INTEGER NOT NULL REFERENCES installers(id), area VARCHAR(60) NOT NULL, lat $f, lon $f,
                install_lat $f, install_lon $f, grid_hours_per_day $f, baseline_kwh_per_day $f, panel_kwp $f,
                battery_kwh $f, installed_on DATE)",
            "CREATE TABLE generators (id $id, site_id INTEGER UNIQUE NOT NULL REFERENCES sites(id),
                serial VARCHAR(60) UNIQUE NOT NULL, fuel VARCHAR(10), rated_kva $f, scrapped_on DATE,
                scrap_certificate VARCHAR(120), scrap_photo VARCHAR(120), trade_in_value_kobo $big DEFAULT 0)",
            "CREATE TABLE inverters (id $id, site_id INTEGER UNIQUE NOT NULL REFERENCES sites(id),
                serial VARCHAR(60) UNIQUE NOT NULL, vendor VARCHAR(30))",
            "CREATE TABLE readings (id $id, inverter_id INTEGER NOT NULL REFERENCES inverters(id), day DATE NOT NULL,
                kwh_generated $f, kwh_solar_to_load $f, kwh_from_grid $f, kwh_from_backup $f, source VARCHAR(20),
                payload_hash VARCHAR(64), UNIQUE (inverter_id, day))",
            "CREATE TABLE sunlight (id $id, area VARCHAR(60) NOT NULL, day DATE NOT NULL, kwh_m2 $f, UNIQUE (area, day))",
            "CREATE TABLE periods (id $id, project VARCHAR(20), start_day DATE NOT NULL, end_day DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'open', sample_seed INTEGER, sample_site_ids TEXT, signed_by VARCHAR(120),
                signed_at VARCHAR(40), total_t $f DEFAULT 0, carried_t $f DEFAULT 0,
                registry_project_id VARCHAR(64), registry_mrv_id VARCHAR(64))",
            "CREATE TABLE site_results (id $id, period_id INTEGER NOT NULL REFERENCES periods(id), site_id INTEGER NOT NULL REFERENCES sites(id),
                tco2e $f, monthly TEXT, trust_score INTEGER, status VARCHAR(12), checks TEXT, generator_share $f,
                grade VARCHAR(1), reviewed INTEGER DEFAULT 0, UNIQUE (period_id, site_id))",
            "CREATE TABLE orders (id $id, buyer_name VARCHAR(120) NOT NULL, buyer_user_id INTEGER, tonnes INTEGER NOT NULL, amount_kobo $big NOT NULL,
                status VARCHAR(20) DEFAULT 'reserved', payment_reference VARCHAR(64) UNIQUE, payment_url VARCHAR(300),
                registry_certificate_id VARCHAR(64), split_at VARCHAR(40), created_at VARCHAR(40), expires_at VARCHAR(40))",
            "CREATE TABLE credits (serial VARCHAR(40) PRIMARY KEY, period_id INTEGER NOT NULL REFERENCES periods(id), vintage INTEGER,
                status VARCHAR(12) DEFAULT 'listed', contributions TEXT, authorised INTEGER DEFAULT 0,
                order_id INTEGER REFERENCES orders(id), retired_for VARCHAR(120), retired_at VARCHAR(40), simulated INTEGER DEFAULT 1)",
            "CREATE TABLE payouts (id $id, order_id INTEGER NOT NULL REFERENCES orders(id), role VARCHAR(20) NOT NULL, recipient VARCHAR(160),
                site_id INTEGER, amount_kobo $big NOT NULL, idempotency_key VARCHAR(64) UNIQUE NOT NULL, reference VARCHAR(64) UNIQUE NOT NULL,
                status VARCHAR(12) DEFAULT 'pending', attempts INTEGER DEFAULT 0, sent_at VARCHAR(40), claimed_at VARCHAR(40), bank_response TEXT)",
            "CREATE TABLE ledger (id $id, ts VARCHAR(40), event_type VARCHAR(40), payload TEXT, prev_hash VARCHAR(64), hash VARCHAR(64) UNIQUE)",
            "CREATE TABLE webhook_events (event_id VARCHAR(80) PRIMARY KEY, event_type VARCHAR(60), status VARCHAR(12) DEFAULT 'received',
                received_at VARCHAR(40), body TEXT)",
        ];
    }
}

<?php

namespace App\Migrations;

/**
 * Family self-onboarding (docs/ONBOARDING_FLOW.md): installers list solar packages, and a family who
 * needs solar or already has it can start on its own, on the website or in Telegram. One row in
 * onboardings follows each family from account creation to a certified home.
 */
final class M010_Onboarding
{
    public static function up(bool $sqlite): array
    {
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        $f = 'DOUBLE PRECISION';
        $big = $sqlite ? 'INTEGER' : 'BIGINT';
        return [
            'ALTER TABLE installers ADD COLUMN area VARCHAR(60)',
            'ALTER TABLE installers ADD COLUMN blurb VARCHAR(240)',
            'ALTER TABLE installers ADD COLUMN listed INTEGER NOT NULL DEFAULT 0',
            "CREATE TABLE installer_packages (id $id, installer_id INTEGER NOT NULL REFERENCES installers(id), name VARCHAR(80) NOT NULL,
                inverter_kva $f NOT NULL, battery_kwh $f NOT NULL, panels INTEGER NOT NULL, panel_w INTEGER NOT NULL,
                price_min_kobo $big NOT NULL, price_max_kobo $big NOT NULL, powers VARCHAR(160))",
            "CREATE TABLE onboardings (id $id, household_id INTEGER UNIQUE NOT NULL REFERENCES households(id),
                user_id INTEGER NOT NULL REFERENCES users(id), path VARCHAR(4) NOT NULL CHECK (path IN ('need','have')),
                status VARCHAR(12) NOT NULL DEFAULT 'started', channel VARCHAR(10), area VARCHAR(60),
                package_id INTEGER REFERENCES installer_packages(id), installer_id INTEGER REFERENCES installers(id),
                payment VARCHAR(6), income_band VARCHAR(10), loan_limit_kobo $big, loan_id VARCHAR(64), loan_status VARCHAR(12),
                inverter_brand VARCHAR(30), inverter_serial VARCHAR(60), generator VARCHAR(10), quote_kobo $big,
                survey_on VARCHAR(20), site_id INTEGER REFERENCES sites(id), events TEXT, created_at VARCHAR(40), updated_at VARCHAR(40))",
            'CREATE INDEX onboardings_installer ON onboardings (installer_id, status)',
        ];
    }
}

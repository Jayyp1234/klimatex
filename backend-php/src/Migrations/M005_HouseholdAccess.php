<?php

namespace App\Migrations;

/**
 * Households sign in with their phone and a 4-digit PIN, and choose where they are paid.
 * The installer registers the phone at the visit; the family proves it with a one-time code.
 */
final class M005_HouseholdAccess
{
    public static function up(bool $sqlite): array
    {
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        return [
            'ALTER TABLE households ADD COLUMN phone VARCHAR(20)',
            // Homes seeded before this migration get the same synthetic number their wallet was opened with.
            "UPDATE households SET phone = (SELECT '+23470000100' || substr(s.label, 6, 2) FROM sites s WHERE s.household_id = households.id AND s.label LIKE 'Home __')
                WHERE phone IS NULL",
            'CREATE UNIQUE INDEX households_phone ON households (phone)',
            "ALTER TABLE households ADD COLUMN payout_method VARCHAR(10) NOT NULL DEFAULT 'wallet'",
            'ALTER TABLE households ADD COLUMN payout_bank_code VARCHAR(10)',
            'ALTER TABLE households ADD COLUMN payout_account VARCHAR(10)',
            'ALTER TABLE households ADD COLUMN payout_account_name VARCHAR(120)',
            'ALTER TABLE households ADD COLUMN payout_updated_at VARCHAR(40)',
            'ALTER TABLE users ADD COLUMN phone VARCHAR(20)',
            'CREATE UNIQUE INDEX users_phone ON users (phone)',
            'ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255)',
            "CREATE TABLE phone_codes (id $id, phone VARCHAR(20) NOT NULL, code_hash VARCHAR(64) NOT NULL,
                expires_at VARCHAR(40) NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, verified_at VARCHAR(40),
                setup_hash VARCHAR(64) UNIQUE, setup_used_at VARCHAR(40), created_at VARCHAR(40) NOT NULL)",
            'CREATE INDEX phone_codes_phone ON phone_codes (phone, created_at)',
        ];
    }
}

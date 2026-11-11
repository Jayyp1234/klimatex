<?php

namespace App\Migrations;

/** Records the registry's side of each period and order (option 1 money flow). */
final class M004_RegistryFlow
{
    public static function up(bool $sqlite): array
    {
        $f = 'DOUBLE PRECISION';
        $big = $sqlite ? 'INTEGER' : 'BIGINT';
        return [
            "ALTER TABLE periods ADD COLUMN registry_kwh $f",
            "ALTER TABLE periods ADD COLUMN registry_tco2e $f",
            "ALTER TABLE periods ADD COLUMN registry_batch_id VARCHAR(64)",
            "ALTER TABLE periods ADD COLUMN registry_credits INTEGER",
            "ALTER TABLE periods ADD COLUMN registry_serial_range VARCHAR(120)",
            "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20)",
            "ALTER TABLE orders ADD COLUMN registry_certificate_url VARCHAR(300)",
            "ALTER TABLE orders ADD COLUMN registry_payout_reference VARCHAR(64)",
            "ALTER TABLE orders ADD COLUMN registry_payout_kobo $big",
            "ALTER TABLE orders ADD COLUMN registry_fee_kobo $big",
        ];
    }
}

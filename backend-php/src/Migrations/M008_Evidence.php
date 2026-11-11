<?php

namespace App\Migrations;

/**
 * Evidence that changes how much a home is credited:
 *   - the meter's stated accuracy at 95% confidence and when it was last calibrated;
 *   - monthly fuel receipts from the year before solar, which turn a surveyed baseline into a measured one.
 */
final class M008_Evidence
{
    public static function up(bool $sqlite): array
    {
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        $f = $sqlite ? 'REAL' : 'DOUBLE PRECISION';
        return [
            "ALTER TABLE inverters ADD COLUMN accuracy_pct $f",
            'ALTER TABLE inverters ADD COLUMN calibrated_on VARCHAR(10)',
            "CREATE TABLE fuel_receipts (id $id, site_id INTEGER NOT NULL REFERENCES sites (id), month VARCHAR(7) NOT NULL,
                litres $f NOT NULL, amount_naira INTEGER NOT NULL, added_by INTEGER, created_at VARCHAR(40) NOT NULL,
                UNIQUE (site_id, month))",
        ];
    }
}

<?php

namespace App\Migrations;

/** Makes the ledger genuinely insert-only at the database level, and indexes the hot paths. */
final class M003_LedgerAndIndexes
{
    public static function up(bool $sqlite): array
    {
        $indexes = [
            "CREATE INDEX idx_credits_status ON credits (status, serial)",
            "CREATE INDEX idx_credits_order ON credits (order_id)",
            "CREATE INDEX idx_orders_status ON orders (status, expires_at)",
            "CREATE INDEX idx_payouts_order ON payouts (order_id)",
            "CREATE INDEX idx_payouts_status ON payouts (status)",
            "CREATE INDEX idx_readings_day ON readings (day)",
        ];
        if ($sqlite) {
            return [...$indexes,
                "CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is insert-only'); END",
                "CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is insert-only'); END",
            ];
        }
        return [...$indexes,
            "CREATE FUNCTION ledger_insert_only() RETURNS trigger AS \$\$ BEGIN RAISE EXCEPTION 'ledger is insert-only'; END; \$\$ LANGUAGE plpgsql",
            "CREATE TRIGGER ledger_no_change BEFORE UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION ledger_insert_only()",
        ];
    }
}

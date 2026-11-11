<?php

namespace App\Models;

use App\Config\Database;
use App\Config\Settings;

final class PayoutRepository
{
    /** Creates the payout row once, however many workers race here, and returns it. */
    public function ensure(array $row): array
    {
        Database::insertIgnore('payouts', $row);
        return $this->findByKey($row['idempotency_key']);
    }

    public function insertIfNew(array $row): bool
    {
        return Database::insertIgnore('payouts', $row);
    }

    public function findByKey(string $key): ?array
    {
        return Database::one('SELECT * FROM payouts WHERE idempotency_key = ?', [$key]);
    }

    public function findByReference(string $reference): ?array
    {
        return Database::one('SELECT * FROM payouts WHERE reference = ?', [$reference]);
    }

    /** Takes exclusive ownership of one payout. An abandoned claim expires so a crash can't strand money. */
    public function claim(int $id): bool
    {
        $stale = gmdate('Y-m-d\TH:i:s\Z', time() - Settings::PAYOUT_CLAIM_SECONDS);
        return Database::run("UPDATE payouts SET claimed_at = ? WHERE id = ? AND status <> 'paid' AND (claimed_at IS NULL OR claimed_at < ?)",
            [now_iso(), $id, $stale])->rowCount() === 1;
    }

    public function update(int $id, array $row): void
    {
        Database::update('payouts', $id, $row);
    }

    public function release(int $id, array $row): void
    {
        Database::update('payouts', $id, $row + ['claimed_at' => null]);
    }

    public function forOrder(int $orderId): array
    {
        return Database::all('SELECT * FROM payouts WHERE order_id = ? ORDER BY id', [$orderId]);
    }

    public function openCount(int $orderId): int
    {
        return (int) Database::val("SELECT COUNT(*) FROM payouts WHERE order_id = ? AND status <> 'paid'", [$orderId]);
    }

    public function householdCount(int $orderId): int
    {
        return (int) Database::val("SELECT COUNT(*) FROM payouts WHERE order_id = ? AND role = 'household'", [$orderId]);
    }

    /** A household's payouts, newest first. */
    public function forSite(int $siteId): array
    {
        return Database::all("SELECT * FROM payouts WHERE site_id = ? AND role = 'household' ORDER BY order_id DESC, id DESC", [$siteId]);
    }

    public function totalForSite(int $siteId): int
    {
        return (int) Database::val("SELECT COALESCE(SUM(amount_kobo), 0) FROM payouts WHERE site_id = ? AND status = 'paid'", [$siteId]);
    }
}

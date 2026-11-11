<?php

namespace App\Models;

use App\Config\Database;

final class CreditRepository
{
    public function create(array $row): void
    {
        Database::insert('credits', $row, '');
    }

    public function find(string $serial): ?array
    {
        return Database::one('SELECT * FROM credits WHERE serial = ?', [$serial]);
    }

    public function countAll(): int
    {
        return (int) Database::val('SELECT COUNT(*) FROM credits');
    }

    /** @return string[] */
    public function serialsByStatus(string $status): array
    {
        return array_column(Database::all('SELECT serial FROM credits WHERE status = ? ORDER BY serial', [$status]), 'serial');
    }

    public function search(array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->conditions($filters);
        $limit = max(1, min(200, $limit));
        $offset = max(0, $offset);
        return Database::all("SELECT c.serial, c.vintage, c.status, c.authorised, c.simulated, p.project
            FROM credits c JOIN periods p ON p.id = c.period_id WHERE $where ORDER BY c.serial LIMIT $limit OFFSET $offset", $params);
    }

    public function count(array $filters): int
    {
        [$where, $params] = $this->conditions($filters);
        return (int) Database::val("SELECT COUNT(*) FROM credits c JOIN periods p ON p.id = c.period_id WHERE $where", $params);
    }

    private function conditions(array $f): array
    {
        $where = ['c.status = ?'];
        $params = [$f['status']];
        if (!empty($f['vintage'])) { $where[] = 'c.vintage = ?'; $params[] = (int) $f['vintage']; }
        if (isset($f['authorised'])) { $where[] = 'c.authorised = ?'; $params[] = $f['authorised'] ? 1 : 0; }
        if (isset($f['projects'])) {
            if ($f['projects'] === []) { return ['1 = 0', []]; }
            $where[] = 'p.project IN (' . implode(',', array_fill(0, count($f['projects']), '?')) . ')';
            array_push($params, ...$f['projects']);
        }
        if (!empty($f['q'])) {
            $match = 'LOWER(c.serial) LIKE ?';
            $params[] = '%' . strtolower($f['q']) . '%';
            if (!empty($f['q_projects'])) {
                $match .= ' OR p.project IN (' . implode(',', array_fill(0, count($f['q_projects']), '?')) . ')';
                array_push($params, ...$f['q_projects']);
            }
            $where[] = "($match)";
        }
        return [implode(' AND ', $where), $params];
    }

    public function vintages(): array
    {
        return array_map('intval', array_column(Database::all('SELECT DISTINCT vintage FROM credits ORDER BY vintage DESC'), 'vintage'));
    }

    /** One row per period. Every credit in a period shares its contributions, so one serial is a template for all. */
    public function summaryByPeriod(): array
    {
        return Database::all("SELECT c.period_id, p.project, p.signed_by, c.vintage, COUNT(*) AS minted,
            SUM(CASE WHEN c.status = 'listed' THEN 1 ELSE 0 END) AS listed, MIN(c.serial) AS sample_serial
            FROM credits c JOIN periods p ON p.id = c.period_id GROUP BY c.period_id, p.project, p.signed_by, c.vintage ORDER BY c.period_id");
    }

    public function retiredAtForOrder(int $orderId): ?string
    {
        return Database::val('SELECT MAX(retired_at) FROM credits WHERE order_id = ?', [$orderId]) ?: null;
    }

    /** Locks the next $n listed serials for the current transaction. */
    public function lockNextListed(int $n): array
    {
        $lock = Database::isSqlite() ? '' : ' FOR UPDATE SKIP LOCKED';
        return array_column(Database::all("SELECT serial FROM credits WHERE status = 'listed' ORDER BY serial LIMIT $n$lock"), 'serial');
    }

    /** Locks exactly these serials if they are still listed. */
    public function lockListed(array $serials): array
    {
        $in = implode(',', array_fill(0, count($serials), '?'));
        $lock = Database::isSqlite() ? '' : ' FOR UPDATE';
        return array_column(Database::all("SELECT serial FROM credits WHERE status = 'listed' AND serial IN ($in) ORDER BY serial$lock", $serials), 'serial');
    }

    /** The status guard makes it impossible for two orders to take the same serial. */
    public function reserve(string $serial, int $orderId): bool
    {
        return Database::run("UPDATE credits SET status = 'reserved', order_id = ? WHERE serial = ? AND status = 'listed'", [$orderId, $serial])->rowCount() === 1;
    }

    public function releaseForOrder(int $orderId): void
    {
        Database::run("UPDATE credits SET status = 'listed', order_id = NULL WHERE order_id = ? AND status = 'reserved'", [$orderId]);
    }

    /** @return int[] the monitoring periods these serials came from */
    public function periodIdsFor(array $serials): array
    {
        $in = implode(',', array_fill(0, count($serials), '?'));
        return array_map('intval', array_column(Database::all("SELECT DISTINCT period_id FROM credits WHERE serial IN ($in)", array_values($serials)), 'period_id'));
    }

    public function periodIdForOrder(int $orderId): ?int
    {
        $id = Database::val('SELECT period_id FROM credits WHERE order_id = ? LIMIT 1', [$orderId]);
        return $id === false ? null : (int) $id;
    }

    public function serialsForOrder(int $orderId): array
    {
        return array_column(Database::all('SELECT serial FROM credits WHERE order_id = ? ORDER BY serial', [$orderId]), 'serial');
    }

    public function contributionsForOrder(int $orderId): array
    {
        return Database::all('SELECT contributions FROM credits WHERE order_id = ?', [$orderId]);
    }

    public function retireForOrder(int $orderId, string $buyer, string $at): void
    {
        Database::run("UPDATE credits SET status = 'retired', retired_for = ?, retired_at = ? WHERE order_id = ? AND status = 'reserved'", [$buyer, $at, $orderId]);
    }

    public function countRetiredForBuyer(int $userId): int
    {
        return (int) Database::val("SELECT COUNT(*) FROM credits c JOIN orders o ON o.id = c.order_id WHERE c.status = 'retired' AND o.buyer_user_id = ?", [$userId]);
    }
}

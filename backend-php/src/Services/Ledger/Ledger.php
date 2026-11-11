<?php

namespace App\Services\Ledger;

use App\Config\Database;

/** Tamper-evident log: hash = SHA-256(prev_hash . canonical JSON). Insert-only. */
final class Ledger
{
    public const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';

    private static function canon(string $type, array $payload, string $ts): string
    {
        $sort = function ($v) use (&$sort) {
            if (is_array($v)) {
                if (array_is_list($v)) return array_map($sort, $v);
                ksort($v);
                return array_map($sort, $v);
            }
            return $v;
        };
        return jenc($sort(['type' => $type, 'payload' => $payload, 'ts' => $ts]));
    }

    public static function append(string $type, array $payload): string
    {
        return Database::tx(function () use ($type, $payload) {
            Database::lock('ledger'); // concurrent writers must not fork the chain
            $prev = self::root();
            $ts = now_iso();
            $hash = hash('sha256', $prev . self::canon($type, $payload, $ts));
            Database::insert('ledger', ['ts' => $ts, 'event_type' => $type, 'payload' => jenc($payload),
                'prev_hash' => $prev, 'hash' => $hash]);
            return $hash;
        });
    }

    public static function root(): string
    {
        return Database::val('SELECT hash FROM ledger ORDER BY id DESC LIMIT 1') ?: self::GENESIS;
    }

    public static function verify(): array
    {
        $prev = self::GENESIS;
        $n = 0;
        foreach (Database::all('SELECT * FROM ledger ORDER BY id') as $e) {
            $exp = hash('sha256', $prev . self::canon($e['event_type'], jdec($e['payload']), $e['ts']));
            if ($e['prev_hash'] !== $prev || $e['hash'] !== $exp) {
                return ['ok' => false, 'broken_at' => (int) $e['id'], 'entries_checked' => $n];
            }
            $prev = $e['hash'];
            $n++;
        }
        return ['ok' => true, 'entries' => $n, 'root' => $prev];
    }
}

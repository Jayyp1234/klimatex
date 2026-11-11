<?php

namespace App\Models;

use App\Config\Database;

/** Small settings store: holding wallet id, registry project id, cached messages, mock bank state. */
final class KvStore
{
    public static function get(string $key): ?string
    {
        return Database::val('SELECT value FROM kv WHERE key = ?', [$key]) ?: null;
    }

    public static function set(string $key, string $value): void
    {
        Database::run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [$key, $value]);
    }
}

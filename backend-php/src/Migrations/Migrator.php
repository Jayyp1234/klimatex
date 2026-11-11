<?php

namespace App\Migrations;

use App\Config\Database;

/** Applies each migration once, in order. Runs at container start, never on a request. */
final class Migrator
{
    private const MIGRATIONS = [
        M001_CoreSchema::class,
        M002_Auth::class,
        M003_LedgerAndIndexes::class,
        M004_RegistryFlow::class,
        M005_HouseholdAccess::class,
        M006_SupportRequests::class,
        M007_Streets::class,
        M008_Evidence::class,
    ];

    /** @return string[] names applied by this run */
    public static function run(): array
    {
        Database::pdo()->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(80) PRIMARY KEY, applied_at VARCHAR(40) NOT NULL)');
        return Database::tx(function () {
            Database::lock('schema_migrations');
            $applied = [];
            foreach (self::MIGRATIONS as $class) {
                if (Database::val('SELECT name FROM schema_migrations WHERE name = ?', [$class])) {
                    continue;
                }
                foreach ($class::up(Database::isSqlite()) as $statement) {
                    Database::pdo()->exec($statement);
                }
                Database::insert('schema_migrations', ['name' => $class, 'applied_at' => now_iso()], '');
                $applied[] = $class;
            }
            return $applied;
        });
    }
}

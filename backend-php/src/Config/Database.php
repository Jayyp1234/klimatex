<?php

namespace App\Config;

use PDO;
use PDOStatement;
use Throwable;

/** PDO wrapper for SQLite (laptop) and Postgres (cluster). Money is integer kobo; JSON is stored as text. */
final class Database
{
    private static ?PDO $pdo = null;
    private static int $depth = 0;

    public static function pdo(): PDO
    {
        if (!self::$pdo) {
            self::$pdo = new PDO(Settings::dsn(), Settings::dbUser(), Settings::dbPass(), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 30,
            ]);
            if (self::isSqlite()) {
                self::$pdo->exec('PRAGMA foreign_keys = ON');
            }
        }
        return self::$pdo;
    }

    public static function reset(): void
    {
        self::$pdo = null;
        self::$depth = 0;
    }

    public static function isSqlite(): bool
    {
        return str_starts_with(Settings::dsn(), 'sqlite:');
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $statement = self::pdo()->prepare($sql);
        $statement->execute($params);
        return $statement;
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function val(string $sql, array $params = [])
    {
        return self::run($sql, $params)->fetchColumn();
    }

    /** Inserts a row and returns its primary key, or null when $pk is empty. */
    public static function insert(string $table, array $row, string $pk = 'id')
    {
        $sql = self::insertSql($table, $row);
        if (!self::isSqlite() && $pk) {
            return self::val($sql . " RETURNING $pk", array_values($row));
        }
        self::run($sql, array_values($row));
        return $pk ? (int) self::pdo()->lastInsertId() : null;
    }

    /** Inserts unless a unique key already exists. True when this call created the row. */
    public static function insertIgnore(string $table, array $row): bool
    {
        return self::run(self::insertSql($table, $row) . ' ON CONFLICT DO NOTHING', array_values($row))->rowCount() === 1;
    }

    private static function insertSql(string $table, array $row): string
    {
        $placeholders = implode(',', array_fill(0, count($row), '?'));
        return "INSERT INTO $table (" . implode(',', array_keys($row)) . ") VALUES ($placeholders)";
    }

    public static function update(string $table, $id, array $row, string $pk = 'id'): void
    {
        $set = implode(',', array_map(fn ($column) => "$column = ?", array_keys($row)));
        self::run("UPDATE $table SET $set WHERE $pk = ?", [...array_values($row), $id]);
    }

    /**
     * Runs $fn in one transaction; nested calls join the outer one. SQLite starts with
     * BEGIN IMMEDIATE so that a read followed by a write can't interleave with another writer.
     */
    public static function tx(callable $fn)
    {
        if (self::$depth > 0) {
            return $fn();
        }
        $pdo = self::pdo();
        self::isSqlite() ? $pdo->exec('BEGIN IMMEDIATE') : $pdo->beginTransaction();
        self::$depth = 1;
        try {
            $result = $fn();
            self::isSqlite() ? $pdo->exec('COMMIT') : $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            self::isSqlite() ? $pdo->exec('ROLLBACK') : $pdo->rollBack();
            throw $e;
        } finally {
            self::$depth = 0;
        }
    }

    /** Serialises writers on $name until the surrounding transaction ends. */
    public static function lock(string $name): void
    {
        if (!self::isSqlite()) {
            self::run('SELECT pg_advisory_xact_lock(hashtext(?))', [$name]);
        }
    }
}

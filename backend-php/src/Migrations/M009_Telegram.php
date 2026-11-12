<?php

namespace App\Migrations;

/**
 * Telegram: which chats are linked to which home, the one-time codes that link them,
 * and the update ids already handled (Telegram retries, so each update runs once).
 */
final class M009_Telegram
{
    public static function up(bool $sqlite): array
    {
        $big = $sqlite ? 'INTEGER' : 'BIGINT';
        return [
            "CREATE TABLE telegram_links (chat_id VARCHAR(32) PRIMARY KEY, user_id INTEGER NOT NULL, household_id INTEGER NOT NULL,
                lang VARCHAR(4) NOT NULL DEFAULT 'en', linked_at VARCHAR(40) NOT NULL)",
            'CREATE INDEX telegram_links_household ON telegram_links (household_id)',
            'CREATE TABLE telegram_codes (code VARCHAR(40) PRIMARY KEY, user_id INTEGER NOT NULL, household_id INTEGER NOT NULL,
                expires_at INTEGER NOT NULL, used_at VARCHAR(40))',
            "CREATE TABLE telegram_updates (update_id $big PRIMARY KEY, received_at VARCHAR(40) NOT NULL)",
        ];
    }
}

<?php

namespace App\Migrations;

/** Families ask for help from the app; staff see every request with the home it came from. */
final class M006_SupportRequests
{
    public static function up(bool $sqlite): array
    {
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        return [
            "CREATE TABLE support_requests (id $id, reference VARCHAR(20) NOT NULL UNIQUE, user_id INTEGER NOT NULL,
                household_id INTEGER, site_id INTEGER, topic VARCHAR(20) NOT NULL, subject VARCHAR(120) NOT NULL,
                message TEXT NOT NULL, contact VARCHAR(10) NOT NULL DEFAULT 'app', share_readings INTEGER NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'received', created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL)",
            'CREATE INDEX support_requests_user ON support_requests (user_id, created_at)',
        ];
    }
}

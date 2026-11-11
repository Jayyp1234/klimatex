<?php

namespace App\Migrations;

final class M002_Auth
{
    public static function up(bool $sqlite): array
    {
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        return [
            "CREATE TABLE users (id $id, email VARCHAR(160) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL, password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(12) NOT NULL CHECK (role IN ('household','installer','auditor','buyer','lender','admin')),
                household_id INTEGER REFERENCES households(id), installer_id INTEGER REFERENCES installers(id),
                active INTEGER NOT NULL DEFAULT 1, created_at VARCHAR(40))",
            "CREATE TABLE refresh_tokens (id $id, user_id INTEGER NOT NULL REFERENCES users(id), token_hash VARCHAR(64) UNIQUE NOT NULL,
                expires_at VARCHAR(40) NOT NULL, revoked_at VARCHAR(40), created_at VARCHAR(40))",
            "CREATE TABLE login_failures (id $id, email VARCHAR(160) NOT NULL, ip VARCHAR(64), failed_at VARCHAR(40) NOT NULL)",
            "CREATE INDEX idx_login_failures_email ON login_failures (email, failed_at)",
            "CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id)",
        ];
    }
}

<?php
/**
 * Defaults to a throwaway SQLite file. To run against Postgres, set TEST_DB_DSN, TEST_DB_USER and TEST_DB_PASS.
 */
require dirname(__DIR__) . '/vendor/autoload.php';

putenv('MODE=mock');
putenv('DB_DSN=' . (getenv('TEST_DB_DSN') ?: 'sqlite:' . sys_get_temp_dir() . '/klimatex-test-' . getmypid() . '.db'));
putenv('DB_USER=' . (getenv('TEST_DB_USER') ?: ''));
putenv('DB_PASS=' . (getenv('TEST_DB_PASS') ?: ''));
putenv('JWT_SECRET=' . str_repeat('klimatex-test-secret-', 3));
putenv('DEMO_PASSWORD=test-password-123');

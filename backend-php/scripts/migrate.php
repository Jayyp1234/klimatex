<?php
/** php scripts/migrate.php  Applies outstanding migrations. Safe to run repeatedly. */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));
$applied = App\Migrations\Migrator::run();
echo $applied ? 'applied: ' . implode(', ', $applied) . PHP_EOL : 'database is up to date' . PHP_EOL;

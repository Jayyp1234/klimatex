<?php
/** php scripts/demo.php  Runs the whole demo story once on a fresh database and prints each step. */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));
App\Migrations\Migrator::run();
echo json_encode((new App\Services\Simulator\DemoService())->run(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

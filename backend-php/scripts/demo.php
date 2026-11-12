<?php
/** php scripts/demo.php [--no-sale]  Runs the demo story once on a fresh database and prints each step.
 *  --no-sale stops after sign-off, so scripts/demo_sale.php can make the sale live. */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));
App\Migrations\Migrator::run();
echo json_encode((new App\Services\Simulator\DemoService())->run(!in_array('--no-sale', $argv, true)), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

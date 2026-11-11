<?php

namespace App\Controllers;

use App\Config\Database;
use App\Config\Settings;
use App\Core\Request;
use App\Core\Response;
use App\Services\Bank\Bank;
use App\Services\Simulator\DemoService;
use App\Services\Simulator\Simulator;
use Throwable;

final class SystemController
{
    public function health(Request $request)
    {
        try {
            Database::val('SELECT 1');
        } catch (Throwable $e) {
            error_log("health check: {$e->getMessage()}");
            return Response::fail($request, 503, 'Database unavailable.');
        }
        return ['ok' => true, 'mode' => Settings::mode(), 'runtime' => 'php ' . PHP_VERSION];
    }

    public function sandboxCheck(): array
    {
        return ['mode' => Settings::mode(), 'key_present' => Settings::gatewayKey() !== '', 'tariff' => Bank::client()->tariff()];
    }

    public function registerWebhook(): array
    {
        return Bank::client()->registerWebhook(Settings::webhookUrl());
    }

    public function seed(): array
    {
        return Simulator::seed();
    }

    public function runDemo(): array
    {
        return (new DemoService())->run();
    }
}

<?php

use App\Controllers\AssistantController;
use App\Controllers\AuditorController;
use App\Controllers\AuditTrailController;
use App\Controllers\AuthController;
use App\Controllers\FleetController;
use App\Controllers\HomeController;
use App\Controllers\MarketController;
use App\Controllers\PublicController;
use App\Controllers\StreetController;
use App\Controllers\TelegramController;
use App\Controllers\TipsController;
use App\Controllers\SupportController;
use App\Controllers\SystemController;
use App\Controllers\WebhookController;
use FastRoute\RouteCollector;

/**
 * The single source of truth for what exists and who may call it.
 * Each handler is [controller, method, access]:
 *   null   public; [] any signed-in user; ['role', ...] only those roles.
 */
return function (RouteCollector $r) {
    $staffAndOwner = ['household', 'installer', 'auditor', 'lender', 'admin'];

    $r->addRoute('GET', '/healthz', [SystemController::class, 'health', null]);
    $r->addRoute('GET', '/api/sandbox/check', [SystemController::class, 'sandboxCheck', ['admin']]);
    $r->addRoute('POST', '/api/sandbox/register-webhook', [SystemController::class, 'registerWebhook', ['admin']]);
    $r->addRoute('POST', '/api/sim/seed', [SystemController::class, 'seed', ['admin']]);
    $r->addRoute('POST', '/api/demo/run', [SystemController::class, 'runDemo', ['admin']]);

    $r->addRoute('POST', '/api/auth/login', [AuthController::class, 'login', null]);
    $r->addRoute('POST', '/api/auth/refresh', [AuthController::class, 'refresh', null]);
    $r->addRoute('POST', '/api/auth/logout', [AuthController::class, 'logout', null]);
    $r->addRoute('GET', '/api/auth/me', [AuthController::class, 'me', []]);
    $r->addRoute('POST', '/api/auth/phone/start', [AuthController::class, 'phoneStart', null]);
    $r->addRoute('POST', '/api/auth/phone/verify', [AuthController::class, 'phoneVerify', null]);
    $r->addRoute('POST', '/api/auth/phone/complete', [AuthController::class, 'phoneComplete', null]);
    $r->addRoute('POST', '/api/auth/phone/login', [AuthController::class, 'phoneLogin', null]);

    $r->addRoute('GET', '/api/homes', [HomeController::class, 'index', ['installer', 'auditor', 'lender', 'admin']]);
    $r->addRoute('GET', '/api/homes/{id:\d+}', [HomeController::class, 'show', $staffAndOwner]);
    $r->addRoute('GET', '/api/homes/{id:\d+}/certificate', [HomeController::class, 'certificate', $staffAndOwner]);
    $r->addRoute('GET', '/api/homes/{id:\d+}/message', [HomeController::class, 'message', $staffAndOwner]);
    $r->addRoute('GET', '/api/homes/{id:\d+}/payouts', [HomeController::class, 'payouts', $staffAndOwner]);
    $r->addRoute('GET', '/api/homes/{id:\d+}/alerts', [HomeController::class, 'alerts', $staffAndOwner]);
    $r->addRoute('GET', '/api/homes/{id:\d+}/street', [StreetController::class, 'forHome', $staffAndOwner]);
    $r->addRoute('GET', '/api/homes/{id:\d+}/tips', [TipsController::class, 'forHome', $staffAndOwner]);
    $r->addRoute('GET', '/api/homes/{id:\d+}/evidence', [TipsController::class, 'evidence', $staffAndOwner]);
    $r->addRoute('POST', '/api/homes/{id:\d+}/meter', [TipsController::class, 'recordMeter', ['installer', 'admin']]);
    $r->addRoute('POST', '/api/homes/mine/fuel-receipts', [TipsController::class, 'addReceipt', ['household']]);
    $r->addRoute('GET', '/api/telegram', [TelegramController::class, 'status', ['household']]);
    $r->addRoute('POST', '/api/telegram/link', [TelegramController::class, 'link', ['household']]);
    $r->addRoute('DELETE', '/api/telegram/link', [TelegramController::class, 'unlink', ['household']]);
    $r->addRoute('POST', '/api/telegram/webhook', [TelegramController::class, 'webhook', null]);
    $r->addRoute('GET', '/api/tips', [TipsController::class, 'fleet', ['installer', 'admin']]);
    $r->addRoute('GET', '/api/fleet', [FleetController::class, 'overview', ['installer', 'lender', 'admin']]);
    $r->addRoute('GET', '/api/homes/mine', [HomeController::class, 'mine', ['household']]);
    $r->addRoute('GET', '/api/homes/mine/payout-details', [HomeController::class, 'payoutDetails', ['household']]);
    $r->addRoute('POST', '/api/homes/mine/payout-details', [HomeController::class, 'savePayoutDetails', ['household']]);
    $r->addRoute('POST', '/api/homes/mine/payout-details/check', [HomeController::class, 'checkPayoutAccount', ['household']]);

    $r->addRoute('GET', '/api/periods', [AuditTrailController::class, 'index', ['auditor', 'admin']]);
    $r->addRoute('GET', '/api/periods/{id:\d+}/trail', [AuditTrailController::class, 'trail', ['auditor', 'admin']]);
    $r->addRoute('POST', '/api/periods', [AuditorController::class, 'create', ['auditor', 'admin']]);
    $r->addRoute('GET', '/api/periods/{id:\d+}', [AuditorController::class, 'show', ['auditor', 'admin']]);
    $r->addRoute('POST', '/api/periods/{id:\d+}/compute', [AuditorController::class, 'compute', ['auditor', 'admin']]);
    $r->addRoute('POST', '/api/periods/{id:\d+}/sample', [AuditorController::class, 'sample', ['auditor']]);
    $r->addRoute('POST', '/api/periods/{id:\d+}/sites/{site:\d+}/review', [AuditorController::class, 'review', ['auditor']]);
    $r->addRoute('POST', '/api/periods/{id:\d+}/signoff', [AuditorController::class, 'signOff', ['auditor']]);

    $r->addRoute('GET', '/api/credits', [MarketController::class, 'credits', null]);
    $r->addRoute('POST', '/api/orders', [MarketController::class, 'create', ['buyer']]);
    $r->addRoute('GET', '/api/orders/{id:\d+}', [MarketController::class, 'show', ['buyer', 'admin']]);
    $r->addRoute('POST', '/api/orders/{id:\d+}/confirm', [MarketController::class, 'confirm', ['buyer', 'admin']]);
    $r->addRoute('POST', '/api/orders/{id:\d+}/release', [MarketController::class, 'release', ['buyer']]);
    $r->addRoute('POST', '/api/orders/{id:\d+}/simulate-payment', [MarketController::class, 'simulatePayment', ['buyer']]);
    $r->addRoute('GET', '/api/market/overview', [MarketController::class, 'overview', ['buyer']]);
    $r->addRoute('GET', '/api/market/orders', [MarketController::class, 'orders', ['buyer']]);

    $r->addRoute('POST', '/api/assistant/ask', [AssistantController::class, 'ask', ['household']]);

    $r->addRoute('GET', '/api/support/requests',[SupportController::class, 'index', ['household', 'installer', 'admin']]);
    $r->addRoute('POST', '/api/support/requests', [SupportController::class, 'create', ['household']]);

    $r->addRoute('GET', '/api/verify/{serial:[A-Za-z0-9\-]+}', [PublicController::class, 'verify', null]);
    $r->addRoute('GET', '/api/ledger/verify', [PublicController::class, 'ledger', null]);
    $r->addRoute('GET', '/api/streets', [StreetController::class, 'index', null]);

    $r->addRoute('POST', '/hooks/forge', [WebhookController::class, 'forge', null]);
};

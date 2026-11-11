<?php

namespace App\Services\Webhook;

use App\Config\Settings;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\OrderRepository;
use App\Models\WebhookEventRepository;
use App\Services\Market\MarketService;
use App\Services\Market\PayoutService;
use Throwable;

/**
 * Sandbox webhooks. An event counts as handled only once processing succeeds, so a failed
 * delivery can be retried. Settlement is left to the worker to stay inside the 10-second limit.
 */
final class WebhookService
{
    public function __construct(
        private WebhookEventRepository $events = new WebhookEventRepository(),
        private OrderRepository $orders = new OrderRepository(),
        private MarketService $market = new MarketService(),
        private PayoutService $payouts = new PayoutService(),
    ) {
    }

    public function handle(Request $request): array
    {
        if (Settings::live()) {
            self::assertSigned($request->raw, $request->header('x-forge-timestamp'), $request->header('x-forge-signature'), Settings::webhookSecret());
        }
        $body = $request->body;
        $eventId = (string) ($body['event_id'] ?? $body['id'] ?? hash('sha256', $request->raw));
        if ($this->events->isProcessed($eventId)) {
            return ['ok' => true, 'duplicate' => true];
        }
        $type = $request->header('x-forge-event') ?: (string) ($body['event'] ?? '');
        $this->events->record($eventId, $type, $request->raw);
        try {
            $this->dispatch($type, (string) ($body['data']['reference'] ?? ''));
            $this->events->markStatus($eventId, 'processed');
        } catch (Throwable $e) {
            $this->events->markStatus($eventId, 'failed');
            throw $e;
        }
        return ['ok' => true];
    }

    public static function assertSigned(string $raw, string $timestamp, string $signature, string $secret): void
    {
        if ($secret === '' || abs(time() - (int) $timestamp) > 300) {
            throw new HttpException(401, 'Stale or unsigned webhook.');
        }
        if (!hash_equals('sha256=' . hash_hmac('sha256', "$timestamp.$raw", $secret), $signature)) {
            throw new HttpException(401, 'Bad webhook signature.');
        }
    }

    private function dispatch(string $type, string $reference): void
    {
        if ($reference === '') {
            return;
        }
        if ($type === 'payment.successful') {
            $order = $this->orders->findByReference($reference);
            if ($order) {
                $this->market->confirm((int) $order['id'], settleNow: false);
            }
        } elseif (str_starts_with($type, 'transfer.')) {
            $this->payouts->applyTransferEvent($reference, $type);
        }
    }
}

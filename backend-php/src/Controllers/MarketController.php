<?php

namespace App\Controllers;

use App\Config\Settings;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\Market\MarketService;

final class MarketController
{
    public function __construct(
        private MarketService $market = new MarketService(),
    ) {
    }

    public function credits(Request $request): array
    {
        $status = (string) $request->query('status', 'listed');
        if (!in_array($status, ['listed', 'reserved', 'retired'], true)) {
            throw new HttpException(422, 'Status must be listed, reserved or retired.', ['status']);
        }
        return $this->market->browse($this->filters($request, $status), (int) $request->query('limit', 200), (int) $request->query('offset', 0));
    }

    public function overview(Request $request): array
    {
        return $this->market->overview((int) $request->user['id']);
    }

    public function orders(Request $request): array
    {
        return ['orders' => $this->market->ordersFor((int) $request->user['id'])];
    }

    private function filters(Request $request, string $status): array
    {
        $filters = ['status' => $status];
        $vintage = $request->query('vintage');
        if ($vintage !== null && $vintage !== '') {
            $filters['vintage'] = (int) $vintage;
        }
        $authorised = $request->query('authorised');
        if ($authorised === 'yes' || $authorised === 'no') {
            $filters['authorised'] = $authorised === 'yes';
        }
        $location = trim((string) $request->query('location', ''));
        if ($location !== '') {
            $filters['projects'] = array_keys(array_filter(Settings::PROJECTS, fn ($p) => strcasecmp($p['state'], $location) === 0));
        }
        $term = trim((string) $request->query('q', ''));
        if ($term !== '') {
            $filters['q'] = substr($term, 0, 60);
            $filters['q_projects'] = array_keys(array_filter(Settings::PROJECTS, fn ($p) => stripos($p['name'], $term) !== false));
        }
        return $filters;
    }

    /** The buyer on the order is the signed-in organisation, not a value from the request. */
    public function create(Request $request): array
    {
        $serials = $request->input('serials', []);
        if (!is_array($serials) || array_filter($serials, fn ($s) => !is_string($s) || !preg_match('/^[A-Za-z0-9\-]{1,40}$/', $s))) {
            throw new HttpException(422, 'Serials must be a list of credit serials.', ['serials']);
        }
        return $this->market->createOrder($request->user['name'], (int) $request->input('tonnes', 0), $request->user['id'], $serials);
    }

    public function show(Request $request, string $id): array
    {
        $this->assertOwner($request, (int) $id);
        return $this->market->summary((int) $id, $request->user['role'] === 'admin');
    }

    public function confirm(Request $request, string $id): array
    {
        $this->assertOwner($request, (int) $id);
        return $this->market->confirm((int) $id, includePayouts: $request->user['role'] === 'admin');
    }

    public function release(Request $request, string $id): array
    {
        $this->assertOwner($request, (int) $id);
        return $this->market->release((int) $id);
    }

    public function simulatePayment(Request $request, string $id): array
    {
        $this->assertOwner($request, (int) $id);
        return $this->market->simulatePayment((int) $id);
    }

    /** Someone else's order looks exactly like one that doesn't exist. */
    private function assertOwner(Request $request, int $id): void
    {
        $order = $this->market->order($id);
        if ($request->user['role'] !== 'admin' && (int) $order['buyer_user_id'] !== $request->user['id']) {
            throw new HttpException(404, 'Order not found.');
        }
    }
}

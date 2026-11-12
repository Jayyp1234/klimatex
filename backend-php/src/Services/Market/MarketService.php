<?php

namespace App\Services\Market;

use App\Config\Database;
use App\Config\Settings;
use App\Core\HttpException;
use App\Models\CreditRepository;
use App\Models\KvStore;
use App\Models\OrderRepository;
use App\Models\PayoutRepository;
use App\Models\PeriodRepository;
use App\Models\UserRepository;
use App\Services\Bank\Bank;
use App\Services\Bank\BankError;
use App\Services\Ledger\Ledger;
use App\Services\Registry\Registry;
use Throwable;

/** reserve serials -> buyer pays -> verify payment -> retire in buyer's name -> split -> payouts */
final class MarketService
{
    public function __construct(
        private OrderRepository $orders = new OrderRepository(),
        private CreditRepository $credits = new CreditRepository(),
        private PayoutRepository $payouts = new PayoutRepository(),
        private PayoutService $payoutService = new PayoutService(),
    ) {
    }

    public function order(int $id): array
    {
        return $this->orders->find($id) ?? throw new HttpException(404, 'Order not found.');
    }

    public function releaseExpired(): void
    {
        foreach (array_map('intval', array_column($this->orders->expiredReservations(now_iso()), 'id')) as $id) {
            Database::tx(function () use ($id) {
                if ($this->orders->transition($id, 'reserved', 'expired')) {
                    $this->credits->releaseForOrder($id);
                    Ledger::append('order.expired', ['order' => $id]);
                }
            });
        }
    }

    /** Reserves the next $tonnes listed credits, or exactly $serials when the buyer picked them. */
    public function createOrder(string $buyer, int $tonnes, ?int $userId = null, array $serials = []): array
    {
        $serials = array_values(array_unique($serials));
        if ($serials !== []) {
            $tonnes = count($serials);
        }
        $buyer = trim($buyer);
        if ($buyer === '') {
            throw new HttpException(422, 'Enter the buyer name.', ['buyer_name']);
        }
        if ($tonnes < 1 || $tonnes > Settings::MAX_ORDER_TONNES) {
            throw new HttpException(422, 'Tonnes must be between 1 and ' . Settings::MAX_ORDER_TONNES . '.', ['tonnes']);
        }
        $this->releaseExpired();

        $amount = $tonnes * Settings::PRICE_PER_CREDIT_KOBO;
        $reference = 'KXO-' . strtoupper(bin2hex(random_bytes(5)));
        $id = Database::tx(function () use ($buyer, $tonnes, $amount, $reference, $userId, $serials) {
            Database::lock('credits.reserve');
            $picked = $serials !== [];
            $serials = $picked ? $this->credits->lockListed($serials) : $this->credits->lockNextListed($tonnes);
            if (count($serials) < $tonnes) {
                throw new HttpException(409, $picked ? 'That credit was just taken. Choose another.' : 'Only ' . count($serials) . ' credits are available.');
            }
            // The registry retires from one batch per payment, and each monitoring period is one batch.
            if (count($this->credits->periodIdsFor($serials)) > 1) {
                throw new HttpException(409, 'Credits in one order must come from the same monitoring period.');
            }
            $id = $this->orders->create(['buyer_name' => $buyer, 'buyer_user_id' => $userId, 'tonnes' => $tonnes, 'amount_kobo' => $amount,
                'status' => 'reserved', 'payment_reference' => $reference, 'created_at' => now_iso(),
                'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 60 * Settings::RESERVATION_MINUTES)]);
            foreach ($serials as $serial) {
                if (!$this->credits->reserve($serial, $id)) {
                    throw new HttpException(409, 'Those credits were just taken. Try again.');
                }
            }
            Ledger::append('order.reserved', ['order' => $id, 'buyer' => $buyer, 'tonnes' => $tonnes, 'amount_kobo' => $amount, 'serials' => $serials]);
            return $id;
        });

        // The bank is called after commit, so a slow gateway never holds the reservation locks.
        try {
            $checkout = Bank::client()->createCheckout(Settings::REGISTRY_MERCHANT, $amount, $reference, "$tonnes KlimateX carbon credits",
                Settings::publicBase() . "/app/marketplace/?order=$id", ['name' => $buyer, 'email' => $this->buyerEmail($userId)], ['order_id' => $id]);
        } catch (Throwable $e) {
            Database::tx(function () use ($id) {
                $this->orders->update($id, ['status' => 'failed']);
                $this->credits->releaseForOrder($id);
                Ledger::append('order.failed', ['order' => $id, 'reason' => 'checkout could not be created']);
            });
            throw $e;
        }
        $url = $checkout['payment_url'] ?? null;
        $this->orders->update($id, ['payment_url' => $url]);
        return ['order' => $id, 'amount_naira' => $amount / 100, 'payment_url' => $url, 'reference' => $reference,
            'expires_at' => $this->order($id)['expires_at'], 'simulated_checkout' => !Settings::live()];
    }

    /**
     * Verifies payment, retires the credits, and (unless $settleNow is false) pays everyone out.
     * Safe to call repeatedly and concurrently: the state transition admits one caller.
     */
    public function confirm(int $id, bool $settleNow = true, bool $includePayouts = true): array
    {
        $order = $this->order($id);
        if (in_array($order['status'], ['retired', 'settled'], true)) {
            if ($settleNow) {
                $this->payoutService->settle($id, force: true);
            }
            return $this->summary($id, $includePayouts);
        }
        if (in_array($order['status'], ['expired', 'released'], true)) {
            $this->flagLatePayment($order);
        }
        if ($order['status'] !== 'reserved') {
            throw new HttpException(409, "This order is {$order['status']}.");
        }

        $payment = Bank::client()->verifyPayment($order['payment_reference']); // always confirm before giving value
        $this->orders->update($id, ['payment_status' => (string) ($payment['status'] ?? 'unknown')]);
        if (!self::paymentCleared($payment, (int) $order['amount_kobo'])) {
            return ['order' => $id, 'payment' => $payment['status'] ?? null, 'action' => 'waiting'];
        }
        if (!$this->orders->transition($id, 'reserved', 'retiring')) {
            return $this->summary($id, $includePayouts); // another request got here first
        }

        try {
            $serials = $this->credits->serialsForOrder($id);
            if (count($serials) !== (int) $order['tonnes']) {
                throw new HttpException(409, 'This order no longer holds the credits it reserved.');
            }
            $period = (new PeriodRepository())->find((int) $this->credits->periodIdForOrder($id));
            // The registry retires against the buyer's payment to it, keeps its fee, and pays the project owner by NIP.
            $retirement = Registry::retire($period['registry_batch_id'], count($serials), $order['buyer_name'], $this->buyerEmail($order['buyer_user_id']),
                (int) intdiv((int) $order['amount_kobo'], count($serials)), $order['payment_reference'],
                "Retired for {$order['buyer_name']} through KlimateX order $id", "retire-$id");
            $certificate = $retirement['retirement_id'];
            $ownerPayout = $retirement['payout'] ?? [];
            Database::tx(function () use ($id, $order, $serials, $certificate, $retirement, $ownerPayout) {
                $this->credits->retireForOrder($id, $order['buyer_name'], now_iso());
                $this->orders->update($id, ['status' => 'retired', 'registry_certificate_id' => $certificate,
                    'registry_certificate_url' => $retirement['certificate_url'] ?? null, 'registry_payout_reference' => $ownerPayout['reference'] ?? null,
                    'registry_payout_kobo' => (int) round(($ownerPayout['amount'] ?? 0) * 100), 'registry_fee_kobo' => (int) round(($retirement['registry_fee'] ?? 0) * 100)]);
                Ledger::append('credits.retired', ['order' => $id, 'buyer' => $order['buyer_name'], 'serials' => $serials, 'certificate' => $certificate]);
                Ledger::append('registry.owner_payout', ['order' => $id, 'reference' => $ownerPayout['reference'] ?? null,
                    'amount_kobo' => (int) round(($ownerPayout['amount'] ?? 0) * 100), 'to' => $ownerPayout['destination_account'] ?? null]);
            });
        } catch (Throwable $e) {
            $this->orders->transition($id, 'retiring', 'reserved');
            throw $e;
        }

        if ($settleNow) {
            $this->payoutService->settle($id, force: true);
        }
        return $this->summary($id, $includePayouts);
    }

    /** The buyer changed their mind: the credits go straight back on sale. */
    public function release(int $id): array
    {
        $released = Database::tx(function () use ($id) {
            if (!$this->orders->transition($id, 'reserved', 'released')) {
                return false;
            }
            $this->credits->releaseForOrder($id);
            Ledger::append('order.released', ['order' => $id]);
            return true;
        });
        if (!$released) {
            throw new HttpException(409, 'This reservation can no longer be released.');
        }
        return ['order' => $id, 'status' => 'released'];
    }

    /** Laptop only: stands in for the hosted checkout, which doesn't exist in mock mode. */
    public function simulatePayment(int $id): array
    {
        if (Settings::live()) {
            throw new HttpException(404, 'Not found.');
        }
        $order = $this->order($id);
        if ($order['status'] !== 'reserved') {
            throw new HttpException(409, "This order is {$order['status']}.");
        }
        Bank::client()->payWithTestCard($order['payment_reference']);
        return ['order' => $id, 'payment' => 'successful'];
    }

    /** @param array{status:string,vintage?:int,authorised?:bool,projects?:string[],q?:string,q_projects?:string[]} $filters */
    public function browse(array $filters, int $limit, int $offset): array
    {
        $price = Settings::PRICE_PER_CREDIT_KOBO / 100;
        $rows = $this->credits->search($filters, $limit, $offset);
        return [
            'count' => $this->credits->count($filters),
            'price_naira' => $price,
            'serials' => array_column($rows, 'serial'),
            'items' => array_map(fn ($row) => [
                'serial' => $row['serial'],
                'vintage' => (int) $row['vintage'],
                'tonnes' => 1.0,
                'status' => $row['status'],
                'authorised' => (bool) $row['authorised'],
                'project' => Settings::PROJECTS[$row['project']]['name'] ?? $row['project'],
                'location' => Settings::PROJECTS[$row['project']]['location'] ?? '',
                'price_naira' => $price,
            ], $rows),
        ];
    }

    /** Everything the buyer's dashboard shows above the credits table. */
    public function overview(int $userId): array
    {
        $this->releaseExpired();
        $projects = [];
        $monthly = [];
        $available = 0;
        foreach ($this->credits->summaryByPeriod() as $row) {
            $code = $row['project'];
            $listed = (int) $row['listed'];
            $available += $listed;
            $sites = [];
            foreach (jdec($this->credits->find($row['sample_serial'])['contributions']) ?? [] as $part) {
                $sites[$part['site_id']] = true;
                if ($listed > 0) {
                    $monthly[$part['month']] = ($monthly[$part['month']] ?? 0) + $part['t'] * $listed;
                }
            }
            $catalogue = Settings::PROJECTS[$code] ?? ['name' => $code, 'location' => '', 'state' => '', 'methodology' => ''];
            $projects[$code] ??= ['code' => $code, 'name' => $catalogue['name'], 'location' => $catalogue['location'], 'state' => $catalogue['state'],
                'methodology' => $catalogue['methodology'], 'vintage' => (int) $row['vintage'], 'minted' => 0, 'listed' => 0, 'homes' => 0, 'auditor' => $row['signed_by']];
            $projects[$code]['minted'] += (int) $row['minted'];
            $projects[$code]['listed'] += $listed;
            $projects[$code]['homes'] = max($projects[$code]['homes'], count($sites));
        }
        ksort($monthly);
        return [
            'available' => $available,
            'price_naira' => Settings::PRICE_PER_CREDIT_KOBO / 100,
            'retired_by_you' => $this->credits->countRetiredForBuyer($userId),
            'projects' => array_values($projects),
            'supply_by_month' => array_map(fn ($month, $tonnes) => ['month' => $month, 'tonnes' => round($tonnes, 3)], array_keys($monthly), $monthly),
            'vintages' => $this->credits->vintages(),
            'locations' => array_values(array_unique(array_filter(array_column($projects, 'state')))),
            'payments' => Settings::live() ? 'live' : 'simulated',
        ];
    }

    public function ordersFor(int $userId): array
    {
        $this->releaseExpired();
        return array_map(function ($order) {
            $id = (int) $order['id'];
            return [
                'id' => $id,
                'status' => $order['status'],
                'tonnes' => (int) $order['tonnes'],
                'amount_naira' => (int) $order['amount_kobo'] / 100,
                'serials' => $this->credits->serialsForOrder($id),
                'expires_at' => $order['expires_at'],
                'retired_on' => $this->credits->retiredAtForOrder($id),
                'certificate' => $order['registry_certificate_id'],
                'certificate_url' => $order['registry_certificate_url'],
                'serial_range' => $this->registrySerialRange($id),
                'payment_status' => $order['payment_status'],
                'payment_url' => $order['status'] === 'reserved' ? $order['payment_url'] : null,
            ];
        }, $this->orders->forBuyer($userId));
    }

    /** Called by the background worker: expire reservations and finish outstanding payouts. */
    public function sweep(): void
    {
        $this->releaseExpired();
        foreach (array_map('intval', array_column($this->orders->awaitingSettlement(), 'id')) as $id) {
            try {
                $this->payoutService->settle($id, force: false);
            } catch (BankError $e) {
                error_log("settling order $id: {$e->getMessage()}");
            }
        }
    }

    public function summary(int $id, bool $includePayouts = true): array
    {
        $order = $this->order($id);
        $payouts = $this->payouts->forOrder($id);
        $byRole = [];
        foreach ($payouts as $payout) {
            $byRole[$payout['role']] = ($byRole[$payout['role']] ?? 0) + (int) $payout['amount_kobo'];
        }
        $out = ['order' => $id, 'status' => $order['status'], 'certificate' => $order['registry_certificate_id'],
            'certificate_url' => $order['registry_certificate_url'], 'payment_status' => $order['payment_status'],
            'total_naira' => (int) $order['amount_kobo'] / 100, 'by_role_naira' => array_map(fn ($kobo) => $kobo / 100, $byRole)];
        $out['money'] = self::reconcile($order, $byRole);
        if ($includePayouts) {
            $out['payouts'] = array_map(fn ($p) => ['role' => $p['role'], 'to' => $p['recipient'], 'naira' => (int) $p['amount_kobo'] / 100, 'status' => $p['status']], $payouts);
        }
        return $out;
    }

    /**
     * Where the buyer's money went, in one balanced line: the registry keeps its fee and pays the rest to the
     * project owner (KlimateX), and KlimateX pays families, the installer, the audit reserve and itself from it.
     * The audit reserve carries the registry fee, so: received = families + installer + (audit - fee) + KlimateX.
     */
    public static function reconcile(array $order, array $byRoleKobo): ?array
    {
        $received = (int) ($order['registry_payout_kobo'] ?? 0);
        if ($received === 0) {
            return null;
        }
        $fee = (int) ($order['registry_fee_kobo'] ?? 0);
        $families = $byRoleKobo['household'] ?? 0;
        $installer = $byRoleKobo['installer'] ?? 0;
        $auditNet = ($byRoleKobo['audit'] ?? 0) - $fee;
        $klimatex = $byRoleKobo['klimatex'] ?? 0;
        $paidOut = $families + $installer + $auditNet + $klimatex;
        return [
            'buyer_paid_naira' => (int) $order['amount_kobo'] / 100,
            'registry_fee_naira' => $fee / 100,
            'received_naira' => $received / 100,
            'received_by' => (Settings::PROJECT_OWNER['payout_account'] === Settings::OPERATING_ACCOUNT ? 'KlimateX operating account' : Settings::PROJECT_OWNER['name'])
                . ' · ' . Settings::PROJECT_OWNER['payout_account'],
            'paid_out_naira' => ['families' => $families / 100, 'installer' => $installer / 100,
                'audit_reserve_after_registry_fee' => $auditNet / 100, 'klimatex' => $klimatex / 100],
            'balanced' => $paidOut === $received,
            'difference_naira' => ($received - $paidOut) / 100,
        ];
    }

    /** Paid in full: the bank says successful AND at least the order amount arrived (partial payments stay pending). */
    public static function paymentCleared(array $payment, int $amountKobo): bool
    {
        return ($payment['status'] ?? '') === 'successful' && (int) round(((float) ($payment['amount_paid'] ?? 0)) * 100) >= $amountKobo;
    }

    private function buyerEmail(int|string|null $userId): string
    {
        $user = $userId ? (new UserRepository())->find((int) $userId) : null;
        return $user['email'] ?? 'buyers@klimatex.example';
    }

    private function registrySerialRange(int $orderId): ?string
    {
        $periodId = $this->credits->periodIdForOrder($orderId);
        return $periodId ? ((new PeriodRepository())->find($periodId)['registry_serial_range'] ?? null) : null;
    }

    /** The buyer paid after their reservation lapsed: no credits are owed, so the money must go back. */
    private function flagLatePayment(array $order): void
    {
        $payment = Bank::client()->verifyPayment($order['payment_reference']);
        if (($payment['status'] ?? '') === 'successful' && $this->orders->transition((int) $order['id'], $order['status'], 'refund_due')) {
            Ledger::append('order.refund_due', ['order' => (int) $order['id'], 'amount_kobo' => (int) $order['amount_kobo']]);
            throw new HttpException(409, 'Payment arrived after the reservation expired. A refund is due.');
        }
    }
}

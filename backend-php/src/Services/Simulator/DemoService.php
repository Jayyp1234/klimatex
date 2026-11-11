<?php

namespace App\Services\Simulator;

use App\Config\Database;
use App\Models\CreditRepository;
use App\Models\UserRepository;
use App\Services\Bank\Bank;
use App\Services\Ledger\Ledger;
use App\Services\Market\MarketService;
use App\Services\Period\PeriodService;

/** The whole story in one call: seed, audit, sell 10 t, pay, retire, split. */
final class DemoService
{
    public const AUDITOR = 'Demo Auditor (team member)';
    public const BUYER = 'Mama Nkechi Provisions Ltd';

    public function __construct(
        private PeriodService $periods = new PeriodService(),
        private MarketService $market = new MarketService(),
        private UserRepository $users = new UserRepository(),
    ) {
    }

    public function run(): array
    {
        $steps = ['seed' => Simulator::seed()];
        $id = $this->periods->create(Simulator::START, Simulator::END);
        $computed = $this->periods->compute($id);
        unset($computed['sites']);
        $steps['compute'] = $computed;
        $steps['sample'] = $this->periods->sample($id, 42);
        foreach ($steps['sample']['sample'] as $site) {
            $held = Database::val('SELECT status FROM site_results WHERE period_id = ? AND site_id = ?', [$id, $site]) === 'held';
            $this->periods->review($id, $site, $held ? 'keep_held' : 'ok', $held ? 'clone pair, needs a site visit' : 'evidence consistent');
        }
        $steps['signoff'] = $this->periods->signOff($id, self::AUDITOR);
        $buyer = $this->users->findByEmail('buyer@demo.klimatex.test');
        // Sell up to 10, but never more than the registry issued for this period.
        $tonnes = min(10, count((new CreditRepository())->serialsByStatus('listed')));
        $order = $this->market->createOrder(self::BUYER, $tonnes, $buyer ? (int) $buyer['id'] : null);
        $steps['order'] = $order;
        Bank::client()->payWithTestCard($order['reference']);
        $steps['settled'] = $this->market->confirm($order['order']);
        $steps['ledger'] = Ledger::verify();
        return $steps;
    }
}

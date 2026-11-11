<?php

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Models\CreditRepository;
use App\Models\PeriodRepository;
use App\Services\Ledger\Ledger;

final class PublicController
{
    public function __construct(
        private CreditRepository $credits = new CreditRepository(),
        private PeriodRepository $periods = new PeriodRepository(),
    ) {
    }

    /** Anyone can check a serial. Homes are pseudonymised. */
    public function verify(Request $request, string $serial): array
    {
        $credit = $this->credits->find($serial) ?? throw new HttpException(404, 'Serial not found.');
        $period = $this->periods->find((int) $credit['period_id']);
        return ['serial' => $credit['serial'], 'vintage' => (int) $credit['vintage'], 'project' => $period['project'], 'status' => $credit['status'],
            'simulated' => (bool) $credit['simulated'], 'authorised' => (bool) $credit['authorised'], 'retired_for' => $credit['retired_for'],
            'retired_at' => $credit['retired_at'], 'auditor' => $period['signed_by'], 'signed_at' => $period['signed_at'],
            'home_months' => array_map(fn ($part) => ['home' => sprintf('home-%03d', $part['site_id']), 'month' => $part['month'], 't' => round($part['t'], 3)], jdec($credit['contributions'])),
            'ledger_root' => Ledger::root()];
    }

    public function ledger(): array
    {
        return Ledger::verify();
    }
}

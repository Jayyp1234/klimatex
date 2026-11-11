<?php

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Middleware\AuthMiddleware;
use App\Models\SiteRepository;
use App\Services\Evidence\EvidenceService;
use App\Services\Home\CreditTips;

/** Credit tips, and the evidence behind them: fuel receipts (household) and meter calibration (installer). */
final class TipsController
{
    public function __construct(private CreditTips $tips = new CreditTips(), private EvidenceService $evidence = new EvidenceService(),
                                private SiteRepository $sites = new SiteRepository())
    {
    }

    public function forHome(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->tips->forSite((int) $id, $request->user['role'] === 'installer');
    }

    public function fleet(Request $request): array
    {
        return $this->tips->forInstaller($request->user['role'] === 'installer' ? (int) $request->user['installer_id'] : null);
    }

    public function evidence(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->evidence->forSite((int) $id);
    }

    public function addReceipt(Request $request): array
    {
        $householdId = $request->user['household_id'] ?? null;
        $siteId = $householdId ? $this->sites->idForHousehold((int) $householdId) : null;
        if (!$siteId) {
            throw new HttpException(404, 'No home is linked to this account yet.');
        }
        return $this->evidence->addReceipt($siteId, (int) $request->user['id'], (string) $request->input('month', ''),
            $request->input('litres'), $request->input('amount_naira'));
    }

    public function recordMeter(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->evidence->recordMeter((int) $id, $request->input('accuracy_pct'), (string) $request->input('calibrated_on', ''));
    }
}

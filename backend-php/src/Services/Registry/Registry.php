<?php

namespace App\Services\Registry;

use App\Config\Settings;
use App\Models\KvStore;
use App\Services\Bank\BankError;
use App\Services\Bank\LiveBank;

/**
 * Forge carbon registry, per the Sandbox API Mock Specification v2:
 * register a project, submit MRV in kWh, verify, then retire against a payment to the registry merchant.
 * The registry converts kWh itself (0.53 tCO2e/MWh for solar replacing diesel) and issues whole credits.
 * In mock mode the same rules run offline so tests see what the sandbox will do.
 */
final class Registry
{
    public const MOCK_FACTOR_T_PER_MWH = 0.53;
    public const REGISTRY_FEE_RATE = 0.02;

    public static function createProject(string $ref): string
    {
        $body = ['name' => Settings::PROJECTS[Settings::PROJECT_CODE]['name'], 'type' => 'solar_replacing_diesel',
            'location' => Settings::PROJECT_LOCATION, 'owner' => Settings::PROJECT_OWNER,
            'methodology' => Settings::PROJECTS[Settings::PROJECT_CODE]['methodology']];
        if (!Settings::live()) {
            return 'prj_' . substr(hash('sha256', $ref), 0, 8);
        }
        return (new LiveBank())->req('POST', '/carbon/projects', $body, $ref)['project_id'];
    }

    /** @return array{submission_id:string, estimated_tco2e:float} */
    public static function submitMrv(string $projectId, string $from, string $to, float $kwh, string $evidenceUrl, array $sensorIds, string $ref): array
    {
        $body = ['period' => ['from' => $from, 'to' => $to], 'metric' => 'energy_generated_kwh', 'value' => round($kwh, 1),
            'evidence_url' => $evidenceUrl, 'sensor_ids' => array_values($sensorIds)];
        if (Settings::live()) {
            return (new LiveBank())->req('POST', "/carbon/projects/$projectId/mrv", $body, $ref);
        }
        $id = 'mrv_' . substr(hash('sha256', $ref), 0, 8);
        $tco2e = round($kwh / 1000 * self::MOCK_FACTOR_T_PER_MWH, 2);
        $state = self::state();
        $state['mrv'][$id] ??= ['status' => 'under_review', 'tco2e' => $tco2e, 'vintage' => (int) substr($to, 0, 4)];
        self::save($state);
        return ['submission_id' => $id, 'estimated_tco2e' => $tco2e];
    }

    /** Admin verification, so the demo doesn't wait 60 seconds for auto-verify. */
    public static function verifyMrv(string $submissionId, string $ref): void
    {
        if (Settings::live()) {
            try {
                (new LiveBank())->req('POST', "/carbon/mrv/$submissionId/review", ['decision' => 'verified'], $ref);
            } catch (BankError $e) {
                if ($e->status !== 409) throw $e; // already verified, e.g. by auto-verify
            }
            return;
        }
        $state = self::state();
        $mrv = $state['mrv'][$submissionId];
        if ($mrv['status'] !== 'verified') {
            $state['batches'] ??= [];
            $credits = (int) floor($mrv['tco2e'] + 1e-9);
            $first = array_sum(array_column($state['batches'], 'issued')) + 1;
            $batch = 'crb_' . substr(hash('sha256', $submissionId), 0, 6);
            $state['batches'][$batch] = ['issued' => $credits, 'remaining' => $credits];
            $state['mrv'][$submissionId] = $mrv + ['status' => 'verified', 'credit_batch_id' => $batch, 'credits_issued' => $credits,
                'serial_range' => sprintf('NG-KLX-%d-%06d to NG-KLX-%d-%06d', $mrv['vintage'], $first, $mrv['vintage'], $first + $credits - 1)];
            $state['mrv'][$submissionId]['status'] = 'verified';
            self::save($state);
        }
    }

    /** @return array{status:string, verified_tco2e?:float, credits_issued?:int, credit_batch_id?:string, serial_range?:string} */
    public static function mrvStatus(string $submissionId): array
    {
        if (Settings::live()) {
            return (new LiveBank())->req('GET', "/carbon/mrv/$submissionId");
        }
        $mrv = self::state()['mrv'][$submissionId];
        return ['status' => $mrv['status'], 'verified_tco2e' => $mrv['tco2e']] + array_intersect_key($mrv, array_flip(['credits_issued', 'credit_batch_id', 'serial_range']));
    }

    /**
     * Retires credits for a buyer who paid the registry merchant. The registry keeps its fee and pays the
     * rest to the project owner by NIP.
     * @return array{retirement_id:string, certificate_url:?string, registry_fee:float, payout:array}
     */
    public static function retire(string $batchId, int $quantity, string $buyerName, string $buyerEmail, int $priceKobo,
                                  string $paymentReference, string $reason, string $ref): array
    {
        $body = ['credit_batch_id' => $batchId, 'quantity' => $quantity, 'buyer' => ['name' => $buyerName, 'email' => $buyerEmail],
            'price_per_credit' => naira($priceKobo), 'currency' => 'NGN', 'payment_reference' => $paymentReference,
            'retirement_reason' => $reason];
        if (Settings::live()) {
            return (new LiveBank())->req('POST', '/carbon/credits/retire', $body, $ref);
        }
        $state = self::state();
        $id = 'ret_' . substr(hash('sha256', $ref), 0, 6);
        if (!isset($state['retirements'][$id])) {
            $remaining = $state['batches'][$batchId]['remaining'] ?? 0;
            if ($quantity > $remaining) {
                throw new BankError(422, ['error' => ['code' => 'INSUFFICIENT_CREDITS', 'message' => "Only $remaining credits remain in $batchId"]]);
            }
            $state['batches'][$batchId]['remaining'] = $remaining - $quantity;
            $total = $quantity * $priceKobo;
            $fee = (int) round($total * self::REGISTRY_FEE_RATE);
            $state['retirements'][$id] = ['retirement_id' => $id, 'quantity' => $quantity, 'total_amount' => naira($total),
                'registry_fee' => naira($fee), 'status' => 'retired', 'certificate_url' => "/v1/carbon/certificates/$id",
                'payout' => ['reference' => 'TRF-' . strtoupper(substr($id, 4)), 'channel' => 'nip', 'amount' => naira($total - $fee),
                    'destination_account' => Settings::PROJECT_OWNER['payout_account'], 'account_name' => strtoupper(Settings::PROJECT_OWNER['name']),
                    'status' => 'pending']];
            self::save($state);
        }
        return $state['retirements'][$id];
    }

    private static function state(): array
    {
        return jdec(KvStore::get('mock_registry')) ?? ['mrv' => [], 'batches' => [], 'retirements' => []];
    }

    private static function save(array $state): void
    {
        KvStore::set('mock_registry', jenc($state));
    }
}

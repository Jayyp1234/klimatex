<?php

namespace App\Services\Carbon;

/** KlimateX home grade (proposed scale): metered share of power still from a generator. */
final class Grade
{
    private const BANDS = ['A' => 0.02, 'B' => 0.10, 'C' => 0.25, 'D' => 0.40, 'E' => 0.55, 'F' => 0.75, 'G' => 1.01];

    public static function forShare(float $share): string
    {
        foreach (self::BANDS as $letter => $upper) {
            if ($share <= $upper) return $letter;
        }
        return 'G';
    }

    public static function beforeShare(float $gridHours): float { return max(0.0, min(1.0, 1 - $gridHours / 24)); }
}

<?php

namespace App\Services\Simulator;

/** Deterministic random numbers, so every demo run gives the same homes. */
final class Rng
{
    public function __construct(int $seed) { mt_srand($seed); }
    public function uniform(float $a, float $b): float { return $a + ($b - $a) * mt_rand() / mt_getrandmax(); }
    public function int(int $a, int $b): int { return mt_rand($a, $b); }
    public function gauss(float $mu, float $sd): float
    {
        $u1 = max(1e-12, mt_rand() / mt_getrandmax());
        $u2 = mt_rand() / mt_getrandmax();
        return $mu + $sd * sqrt(-2 * log($u1)) * cos(2 * M_PI * $u2);
    }
}

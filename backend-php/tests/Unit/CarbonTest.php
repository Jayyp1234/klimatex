<?php

namespace Tests\Unit;

use App\Services\Carbon\Carbon;
use App\Services\Carbon\Checks;
use App\Services\Carbon\Grade;
use PHPUnit\Framework\TestCase;

final class CarbonTest extends TestCase
{
    public function testWorkedExampleFromTheSystemGuide(): void
    {
        // 0.152 MWh x 1.2925 x 0.95 - 0.01 = 0.177 t
        $this->assertEqualsWithDelta(0.177, Carbon::siteMonth(152, 0, 30, 6, 3.5, 0)['er_t'], 0.002);
    }

    public function testAMeterOutsideFivePercentIsCreditedAtTheLowEnd(): void
    {
        $full = Carbon::siteMonth(152, 0, 30, 6, 3.5, 0, 5.0);
        $this->assertSame(152.0, $full['eg_credited_kwh'], '±5% is within the limit');
        $loose = Carbon::siteMonth(152, 0, 30, 6, 3.5, 0, 8.0);
        $this->assertEqualsWithDelta(152 * 0.92, $loose['eg_credited_kwh'], 0.001);
        $this->assertSame(0.08, $loose['meter_deduction']);
        $this->assertSame(0.1, Carbon::siteMonth(152, 0, 30, 6, 3.5, 0, null)['meter_deduction'], 'no certificate counts as ±10%');
        $this->assertLessThan($full['er_t'], $loose['er_t']);
    }

    public function testASurveyedBaselineIsCreditedTenPercentLower(): void
    {
        $measured = Carbon::siteMonth(152, 0, 30, 6, 3.5, 0, 1.0, 'measured');
        $surveyed = Carbon::siteMonth(152, 0, 30, 6, 3.5, 0, 1.0, 'surveyed');
        $this->assertEqualsWithDelta($measured['be_t'] * 0.9, $surveyed['be_t'], 0.0001);
        $this->assertSame('gs-just-v1', Carbon::methodology()->code());
    }

    public function testGradeBands(): void
    {
        $this->assertSame('A', Grade::forShare(0.01));
        $this->assertSame('B', Grade::forShare(0.0598));
        $this->assertSame('F', Grade::forShare(0.75));
        $this->assertSame('G', Grade::forShare(0.9));
    }

    public function testADayWithoutIrradianceCannotEarnCredit(): void
    {
        $site = ['panel_kwp' => 1.5, 'lat' => 6.5, 'lon' => 3.3, 'install_lat' => 6.5, 'install_lon' => 3.3,
            'generator' => ['scrapped_on' => '2026-01-01', 'scrap_certificate' => 'R1']];
        $reading = ['kwh_generated' => 99.0, 'kwh_solar_to_load' => 80.0, 'kwh_from_grid' => 1.0, 'kwh_from_backup' => 0.0];
        [$checks, $failed] = Checks::runSite($site, ['2026-01-01' => $reading], [], ['2026-01-01'], []);
        $this->assertSame('fail', $checks[0]['result']);
        $this->assertSame(1, $checks[0]['evidence']['days_without_irradiance']);
        $this->assertArrayHasKey('2026-01-01', $failed);
    }
}

<?php

namespace Tests\Integration;

use App\Services\Ai\Maas;
use Tests\Support\ApiTestCase;

final class StreetAndMessageTest extends ApiTestCase
{
    public function testStreetGradesCountEveryHomeAndPublishOnlyTotals(): void
    {
        $this->signedPeriod();
        $res = $this->call('GET', '/api/streets');
        $this->assertSame(200, $res->status, 'street grades are public');
        $streets = array_column($res->body['data']['streets'], null, 'name');

        // Bode Thomas: all 6 homes verified on solar. Adeniran Ogunsanya: Home 04 is held, so it counts at its old generator use.
        $this->assertSame('A', $streets['Bode Thomas Street']['grade']);
        $this->assertSame('C', $streets['Adeniran Ogunsanya Street']['grade']);
        $this->assertSame(4, $streets['Adeniran Ogunsanya Street']['homes_verified']);
        $this->assertSame(['B', 1], [$streets['Adeniran Ogunsanya Street']['next_grade'], $streets['Adeniran Ogunsanya Street']['homes_needed_for_next']]);
        $this->assertSame('D', $streets['Ogunlana Drive']['grade']);
        $this->assertArrayNotHasKey('Akerele Street', $streets, 'only 2 verified homes (17 excluded, 19 held): one home could be worked out, so it stays private');
        $this->assertSame(['Bode Thomas Street', 'Adeniran Ogunsanya Street', 'Ogunlana Drive'], array_column($res->body['data']['streets'], 'name'));

        $this->assertSame(['id', 'name', 'area', 'grade', 'generator_share', 'homes_total', 'homes_on_klimatex', 'homes_verified', 'next_grade', 'homes_needed_for_next'],
            array_keys($res->body['data']['streets'][0]), 'no home, name or address leaves in the public list');
    }

    public function testStreetsWithFewerThanThreeHomesStayPrivate(): void
    {
        $this->signedPeriod();
        \App\Config\Database::run("UPDATE sites SET street_id = NULL WHERE label IN ('Home 14', 'Home 15', 'Home 16')");
        $names = array_column($this->call('GET', '/api/streets')->body['data']['streets'], 'name');
        $this->assertNotContains('Ogunlana Drive', $names, 'down to 2 verified homes: hidden');
        $this->assertSame(404, $this->call('GET', '/api/homes/12/street', null, 'household')->status, 'and its families get no street grade');
    }

    public function testOpeningANewPeriodDoesNotBlankStreetGrades(): void
    {
        $this->signedPeriod();
        (new \App\Services\Period\PeriodService())->create('2026-07-01', '2026-12-31');
        $streets = array_column($this->call('GET', '/api/streets')->body['data']['streets'], 'grade', 'name');
        $this->assertSame('A', $streets['Bode Thomas Street'] ?? null);
    }

    public function testAFamilySeesItsOwnStreetOnly(): void
    {
        $this->signedPeriod();
        $mine = $this->call('GET', '/api/homes/12/street', null, 'household')->body['data'];
        $this->assertSame('Ogunlana Drive', $mine['street']['name']);
        $this->assertSame('B', $mine['home_grade']);
        $this->assertSame(403, $this->call('GET', '/api/homes/3/street', null, 'household')->status);
    }

    public function testMonthlyMessageUsesTheTemplateInEachLanguageWithoutTheModel(): void
    {
        $this->signedPeriod();
        $pcm = $this->call('GET', '/api/homes/12/message', null, 'household', ['lang' => 'pcm'])->body['data'];
        $this->assertSame('template', $pcm['source']);
        $this->assertStringStartsWith('Adaeze, your house na grade B.', $pcm['text']);
        $yo = $this->call('GET', '/api/homes/12/message', null, 'household', ['lang' => 'yo'])->body['data'];
        $this->assertStringContainsString('ipele B', $yo['text']);
    }

    public function testDustyPanelsRaiseAnAlertWithTheShortfall(): void
    {
        $this->signedPeriod();
        $alerts = $this->call('GET', '/api/homes/4/alerts', null, 'admin')->body['data']['alerts'];
        $dust = array_values(array_filter($alerts, fn ($a) => $a['kind'] === 'low_output'))[0] ?? null;
        $this->assertNotNull($dust, 'Home 04 is seeded with a dusty last week');
        $this->assertMatchesRegularExpression('/cut your output \\d+% this week\\. Clean your panels/', $dust['body']);
        $this->assertSame([], array_filter($this->call('GET', '/api/homes/12/alerts', null, 'household')->body['data']['alerts'], fn ($a) => $a['kind'] === 'low_output'));
    }

    public function testALiveModelOutageFallsBackInsteadOfFailing(): void
    {
        putenv('MODE=live');
        putenv('MAAS_BASE_URL=http://127.0.0.1:9');
        try {
            $message = Maas::familyMessage('Adaeze', 'B', 96, 0.18, 'held', 'decommissioned', 'en');
        } finally {
            putenv('MODE=mock');
            putenv('MAAS_BASE_URL');
        }
        $this->assertSame('template', $message['source']);
        $this->assertSame('Hi Adaeze, your home is grade B. You avoided about 96 L of petrol (0.18 t of CO2) this month. This month is on hold because the proof that your old generator was scrapped is still missing. Nothing is lost.', $message['text']);
    }
}

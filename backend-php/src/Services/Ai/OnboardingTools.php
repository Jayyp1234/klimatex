<?php

namespace App\Services\Ai;

use App\Config\Settings;
use App\Core\HttpException;
use App\Services\Onboarding\Catalog;
use App\Services\Onboarding\OnboardingService;

/**
 * Read-only tools for a family that is still signing up (no certified home yet). Same shape as
 * AssistantTools: no arguments, the family is fixed. Nothing here can change their choices.
 */
final class OnboardingTools
{
    private array $cache = [];

    public function __construct(private int $householdId, private OnboardingService $onboarding = new OnboardingService(), private Catalog $catalog = new Catalog())
    {
    }

    public static function definitions(): array
    {
        $tool = fn (string $name, string $description) => ['type' => 'function', 'function' => [
            'name' => $name, 'description' => $description, 'parameters' => ['type' => 'object', 'properties' => new \stdClass()]]];
        return [
            $tool('my_progress', 'This family\'s sign-up: need solar or already have it, the package and installer they chose, cash or loan, loan pre-check, quote, visit date, which steps are done, what happens next and whose move it is, and their yearly estimate.'),
            $tool('solar_packages', 'Every listed installer and solar package: size, battery, panels, what it powers, price range in naira, the installer\'s metered homes, and each package\'s yearly estimate.'),
            $tool('loan_options', 'The Access solar loan pre-check: income ranges and how much each could borrow over 24 months, and how the loan works with the quote.'),
            $tool('how_it_works', 'How KlimateX works for a family: the steps from sign-up to payouts, the generator trade-in, how readings are checked, how carbon money is split and when it is paid, and what the family can still change.'),
        ];
    }

    public static function names(): array
    {
        return array_map(fn ($t) => $t['function']['name'], self::definitions());
    }

    public function run(string $name): array
    {
        if (!in_array($name, self::names(), true)) {
            return ['error' => "No tool called $name."];
        }
        try {
            return $this->cache[$name] ??= $this->$name();
        } catch (HttpException $e) {
            return ['unavailable' => $e->getMessage()];
        }
    }

    private function my_progress(): array
    {
        $v = $this->onboarding->mine($this->householdId);
        return [
            'path' => $v['path'] === 'need' ? 'needs solar' : 'already has solar', 'status' => $v['status'],
            'package' => $v['package'] ? ['name' => $v['package']['name'], 'price_naira' => [$v['package']['price_min_naira'], $v['package']['price_max_naira']],
                'powers' => $v['package']['powers']] : null,
            'installer' => $v['installer']['name'] ?? null, 'payment' => $v['payment'], 'loan' => $v['loan'],
            'quote_naira' => $v['quote_naira'], 'visit_or_survey_date' => $v['survey_on'],
            'inverter' => $v['inverter'], 'generator' => $v['generator'],
            'steps_done' => array_values(array_map(fn ($s) => $s['label'], array_filter($v['steps'], fn ($s) => $s['done']))),
            'steps_to_come' => array_values(array_map(fn ($s) => $s['label'], array_filter($v['steps'], fn ($s) => !$s['done']))),
            'next' => $v['next'], 'yearly_estimate' => $v['estimate'], 'can_change_choices' => $v['can_change'],
        ];
    }

    private function solar_packages(): array
    {
        $list = $this->catalog->list();
        return ['note' => $list['note'], 'price_range_naira' => $list['price_range_naira'], 'family_home_range_naira' => $list['family_home_range_naira'],
            'installers' => array_map(fn ($i) => ['name' => $i['name'], 'area' => $i['area'], 'metered_homes' => $i['metered_homes'],
                'average_trust_score' => $i['average_trust_score'], 'packages' => array_map(fn ($p) => ['name' => $p['name'],
                    'inverter_kva' => $p['inverter_kva'], 'battery_kwh' => $p['battery_kwh'], 'panels' => $p['panels'], 'powers' => $p['powers'],
                    'price_naira' => [$p['price_min_naira'], $p['price_max_naira']], 'yearly_estimate' => $p['estimate']], $i['packages'])], $list['installers'])];
    }

    private function loan_options(): array
    {
        return ['lender' => 'Access Bank', 'months' => 24, 'pre_check_only' => true,
            'income_ranges' => array_map(fn ($k, $b) => ['range' => $b['label'], 'could_borrow_naira' => OnboardingService::loanLimit($k)],
                array_keys(OnboardingService::INCOME_BANDS), OnboardingService::INCOME_BANDS),
            'how' => 'The pre-check estimates what Access could lend. Access decides when the family accepts the installer\'s quote. In this demo the bank approves up to ₦1,000,000; any balance is paid in cash, and the generator trade-in helps with the deposit. Carbon payouts can go straight to repaying the loan.'];
    }

    private function how_it_works(): array
    {
        return [
            'steps_need_solar' => 'Pick a package, choose cash or a loan, create the account, do the loan pre-check if needed, send the request. The installer accepts, surveys the home and sends a quote. The family accepts it (the loan is approved then), and on install day the installer fits the system, takes the old generator as a trade-in and pairs the inverter. The home is then certified and live.',
            'steps_have_solar' => 'Create the account, link the inverter (brand and serial), say what happens to the generator, and pick any listed installer. The installer visits to check the inverter and generator, then the home is certified and live.',
            'generator' => 'A generator traded in is scrapped with a recycler certificate. A generator kept as backup must supply under 10% of the home\'s power, or the home earns no credits that period.',
            'checks' => 'Every daily reading is checked nine ways (against the sun, against other homes, for copied or impossible data, missing days, and generator use) before any carbon is credited.',
            'money' => sprintf('Companies buy the carbon credits. After each audited period is signed off and its credits are sold, %d%% goes to families by the tonnes each home earned, paid into their Access wallet or onto their solar loan. The split and the ₦%s price per credit are illustrative.',
                Settings::SPLIT['household'] / 100, number_format(Settings::PRICE_PER_CREDIT_KOBO / 100)),
            'changing_your_mind' => 'Name and area can change any time. The package, cash or loan, and the installer can change until the family accepts the quote; a change after the installer has acted sends a fresh request. The family can also cancel and start again. Use "Change my choices" on the progress page or in the chat menu.',
            'prices' => 'Package prices are sample figures from demo installers. The installer confirms the final price after the survey.',
        ];
    }

    /** Without a model: point to the next step, or answer the commonest questions from the tools. */
    public function guided(string $message): array
    {
        $m = mb_strtolower($message);
        $v = $this->my_progress();
        $answer = match (true) {
            (bool) preg_match('/loan|borrow|bank|access/', $m) => $this->loan_options()['how'],
            (bool) preg_match('/cost|price|how much|naira|₦/', $m) => sprintf('Systems listed on KlimateX cost ₦%s to ₦%s; a typical family home costs ₦%s to ₦%s. Your installer confirms the final price after the survey.',
                ...array_map('number_format', [...$this->catalog->list()['price_range_naira'], ...$this->catalog->list()['family_home_range_naira']])),
            (bool) preg_match('/change|cancel|different|switch/', $m) => $this->how_it_works()['changing_your_mind'],
            (bool) preg_match('/pay|paid|money|earn|carbon/', $m) => $this->how_it_works()['money'],
            default => 'Here is where you are: ' . $v['next']['text'],
        };
        return [$answer, ['my_progress']];
    }
}

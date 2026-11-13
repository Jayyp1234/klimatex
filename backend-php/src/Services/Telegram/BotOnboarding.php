<?php

namespace App\Services\Telegram;

use App\Config\Database;
use App\Core\HttpException;
use App\Models\HouseholdRepository;
use App\Models\KvStore;
use App\Services\Auth\PhoneAuthService;
use App\Services\Onboarding\Catalog;
use App\Services\Onboarding\OnboardingService;

/**
 * Sign-up inside Telegram (docs/ONBOARDING_FLOW.md), the same steps as the website:
 *   welcome → have solar or need it? → packages or perks → share phone (Telegram proves it is the
 *   sender's own number, so no code is needed) → name → area → account created → the remaining
 *   steps → the tracker, until an installer certifies the home.
 *
 * Buttons carry "o:..." callback data. Answers that need typing (name, area, inverter serial) are
 * kept in a short-lived state per chat.
 */
final class BotOnboarding
{
    private const STATE_TTL = 1800;
    private const AREAS = ['Surulere', 'Yaba', 'Ikeja', 'Lekki', 'Ikorodu', 'Ajah'];

    private const T = [
        'welcome' => [
            'en' => "👋 Welcome to KlimateX.\n\nWe help Lagos homes move off the generator onto solar, keep that solar working, and pay the family for the carbon it saves, through Access Bank.\n\nWhat would you like to do?",
            'pcm' => "👋 You don land for KlimateX.\n\nWe dey help Lagos houses comot from gen go solar, we dey make sure the solar dey work well, and we dey pay the family for the carbon wey e save, through Access Bank.\n\nWetin you wan do?",
            'yo' => "👋 Ẹ káàbọ̀ sí KlimateX.\n\nA ń ran àwọn ilé Èkó lọ́wọ́ láti fi jẹnẹrétọ̀ sílẹ̀ fún sólá, a ń tọ́jú sólá náà, a sì ń san owó fún ẹbí fún erogba tí wọ́n dá sí, láti ọwọ́ Access Bank.\n\nKí lẹ fẹ́ ṣe?",
            'ig' => "👋 Nnọọ na KlimateX.\n\nAnyị na-enyere ụlọ ndị Lagos aka ịhapụ jenerẹtọ banye na sola, na-elekọta sola ahụ, ma na-akwụ ezinụlọ ụgwọ maka carbon ha chekwara, site na Access Bank.\n\nGịnị ka ị chọrọ ime?",
            'ha' => "👋 Barka da zuwa KlimateX.\n\nMuna taimaka wa gidajen Legas su bar janareta su koma hasken rana, mu kula da shi, kuma mu biya iyali kuɗin carbon da suka ceta, ta Access Bank.\n\nMe kake so ka yi?",
        ],
        'btn_what' => ['en' => 'ℹ️ What is KlimateX?', 'pcm' => 'ℹ️ Wetin be KlimateX?', 'yo' => 'ℹ️ Kí ni KlimateX?', 'ig' => 'ℹ️ Gịnị bụ KlimateX?', 'ha' => 'ℹ️ Menene KlimateX?'],
        'btn_start' => ['en' => '🚀 Get started', 'pcm' => '🚀 Make we start', 'yo' => '🚀 Bẹ̀rẹ̀', 'ig' => '🚀 Malite', 'ha' => '🚀 Fara'],
        'btn_account' => ['en' => '🔑 I have an account', 'pcm' => '🔑 I get account', 'yo' => '🔑 Mo ní àkáǹtì', 'ig' => '🔑 Enwere m akaụntụ', 'ha' => '🔑 Ina da asusu'],
        'what' => [
            'en' => "KlimateX in one minute:\n\n• Your installer fits solar and takes your old generator as a trade-in.\n• Your inverter reports every day. We check each reading nine ways, so the saving is proven.\n• Companies buy the carbon your home saves. Half of the money goes to your family, straight into your Access wallet or onto your solar loan.\n\nYou don't need an app. Everything works right here in this chat.",
            'pcm' => "KlimateX for one minute:\n\n• Your installer go put solar, and e go collect your old gen as trade-in.\n• Your inverter dey report every day. We dey check each reading nine ways, so the saving dey proven.\n• Companies dey buy the carbon wey your house save. Half of the money go your family, straight enter your Access wallet or your solar loan.\n\nYou no need app. Everything dey work for this chat.",
        ],
        'ask_solar' => ['en' => 'Do you already have solar at home?', 'pcm' => 'You don get solar for house?'],
        'btn_need' => ['en' => '☀️ I need solar', 'pcm' => '☀️ I need solar'],
        'btn_have' => ['en' => '✅ I already have solar', 'pcm' => '✅ I don get solar'],
        'btn_back' => ['en' => '⬅️ Back', 'pcm' => '⬅️ Go back'],
        'packages_title' => ['en' => 'Solar packages on KlimateX', 'pcm' => 'Solar packages for KlimateX'],
        'packages_range' => ['en' => 'Systems cost %s to %s. A typical family home (3–3.5 kVA) costs %s to %s.', 'pcm' => 'Systems dey cost %s reach %s. Normal family house (3–3.5 kVA) na %s reach %s.'],
        'packages_pick' => ['en' => 'Tap a package to see what it powers and what it could save you.', 'pcm' => 'Press any package make you see wetin e fit carry and how much e fit save you.'],
        'new_installer' => ['en' => 'New on KlimateX', 'pcm' => 'New for KlimateX'],
        'metered' => ['en' => '%d metered homes · trust %d/100', 'pcm' => '%d houses wey we dey meter · trust %d/100'],
        'price' => ['en' => 'Price', 'pcm' => 'Price'],
        'powers' => ['en' => 'Powers', 'pcm' => 'E fit carry'],
        'estimate_title' => ['en' => 'Estimate for a year', 'pcm' => 'Estimate for one year'],
        'est_solar' => ['en' => 'Solar made', 'pcm' => 'Solar wey e go make'],
        'est_petrol' => ['en' => 'Petrol not burned', 'pcm' => 'Fuel wey you no go buy'],
        'est_carbon' => ['en' => 'Your carbon income', 'pcm' => 'Your carbon money'],
        'est_note' => ['en' => 'Estimate from the system size. Your meter readings replace it once you are live.', 'pcm' => 'Na estimate from the system size. Your meter readings go replace am once you dey live.'],
        'how_pay' => ['en' => 'How would you like to pay?', 'pcm' => 'How you wan pay?'],
        'btn_cash' => ['en' => '💵 Pay cash', 'pcm' => '💵 I go pay cash'],
        'btn_loan' => ['en' => '🏦 Loan required', 'pcm' => '🏦 I need loan'],
        'btn_all' => ['en' => '⬅️ All packages', 'pcm' => '⬅️ All packages'],
        'perks' => [
            'en' => "Already on solar? Here is what connecting it to KlimateX gives you:\n\n🔔 Alerts when your output drops or your inverter goes offline\n♻️ A trade-in for the generator you kept\n📜 A metered energy grade and certificate for your home\n🏦 Upgrade loans (like a bigger battery) priced on your own data\n💸 Carbon payouts from the day you join, once the verifier confirms your home qualifies",
            'pcm' => "You don get solar? See wetin you go gain if you connect am to KlimateX:\n\n🔔 We go alert you when your solar output drop or your inverter off\n♻️ Trade-in for the gen wey you still keep\n📜 Energy grade and certificate for your house\n🏦 Upgrade loan (like bigger battery) wey dem price with your own data\n💸 Carbon money from the day you join, once the verifier confirm say your house qualify",
        ],
        'btn_connect' => ['en' => '🔗 Connect my solar', 'pcm' => '🔗 Connect my solar'],
        'share_need' => ['en' => "Good choice. To save it and send it to %s, share your phone number with the button below.\n\nThat creates your KlimateX account. No password needed: Telegram already proves the number is yours.", 'pcm' => "Better choice. Make we save am and send am to %s, share your phone number with the button for down.\n\nE go create your KlimateX account. You no need password: Telegram don already prove say the number na your own."],
        'share_have' => ['en' => "Let's connect your solar. First, share your phone number with the button below.\n\nThat creates your KlimateX account. No password needed: Telegram already proves the number is yours.", 'pcm' => "Make we connect your solar. First, share your phone number with the button for down.\n\nE go create your KlimateX account. You no need password: Telegram don already prove say the number na your own."],
        'btn_share' => ['en' => '📱 Share my phone number', 'pcm' => '📱 Share my phone number'],
        'own_number' => ['en' => 'Please share your own number with the button.', 'pcm' => 'Abeg share your own number with the button.'],
        'has_account' => ['en' => 'This number already has a KlimateX account. Send your 4-digit PIN to sign in, or /cancel.', 'pcm' => 'This number don get KlimateX account before. Send your 4-digit PIN make you sign in, or /cancel.'],
        'ask_name' => ['en' => 'Thanks! What should we call you? Type your name, or tap the button.', 'pcm' => 'Thank you! Wetin we go dey call you? Type your name, or press the button.'],
        'btn_use_name' => ['en' => 'Use "%s"', 'pcm' => 'Use "%s"'],
        'ask_area' => ['en' => 'Which area of Lagos is the home in? Tap one, or type it.', 'pcm' => 'Which area for Lagos the house dey? Press one, or type am.'],
        'created' => ['en' => "✅ Your KlimateX account is ready, %s.\n\nTo use the website later, sign in with this number and choose a PIN.", 'pcm' => "✅ Your KlimateX account don ready, %s.\n\nIf you wan use the website later, sign in with this number and choose PIN."],
        'loan_ask' => ['en' => "🏦 Quick Access loan check. Roughly how much does your household earn a month?\n\nThis is only a pre-check. Access decides the real loan after your quote.", 'pcm' => "🏦 Quick Access loan check. How much your house dey earn for one month, roughly?\n\nNa only pre-check. Access go decide the real loan after your quote."],
        'loan_result' => ['en' => "Access could lend you up to about %s over %d months (about %s a month).\n\nYour %s package costs %s to %s.", 'pcm' => "Access fit borrow you reach about %s for %d months (about %s every month).\n\nYour %s package na %s reach %s."],
        'send_ask' => ['en' => 'Ready to send your request to %s? They will book a survey of your home and send you a quote.', 'pcm' => 'You ready make we send your request to %s? Dem go come check your house and send you quote.'],
        'btn_send' => ['en' => '📨 Send request', 'pcm' => '📨 Send request'],
        'brand_ask' => ['en' => 'Which brand is your inverter?', 'pcm' => 'Which brand be your inverter?'],
        'serial_ask' => ['en' => 'Type the serial number from the sticker on your inverter (for example GW5048D123456).', 'pcm' => 'Type the serial number wey dey the sticker for your inverter (like GW5048D123456).'],
        'gen_ask' => ['en' => 'What happens to your generator?', 'pcm' => 'Wetin you wan do with your gen?'],
        'gen_trade_in' => ['en' => '♻️ Trade it in', 'pcm' => '♻️ Trade am in'],
        'gen_backup' => ['en' => '🔌 Keep it as backup', 'pcm' => '🔌 Keep am as backup'],
        'gen_none' => ['en' => '🚫 No generator', 'pcm' => '🚫 I no get gen'],
        'inst_ask' => ['en' => 'Pick an installer for your check visit. They confirm your inverter and generator, then your home goes live.', 'pcm' => 'Pick installer wey go come check your house. Dem go confirm your inverter and gen, then your house go live.'],
        'tracker' => ['en' => 'Your KlimateX progress', 'pcm' => 'Your KlimateX progress'],
        'next' => ['en' => 'Next', 'pcm' => 'Next'],
        'locked' => ['en' => '🔒 Your grade, payouts and certificate unlock when your home is certified.', 'pcm' => '🔒 Your grade, money and certificate go open when dem certify your house.'],
        'btn_progress' => ['en' => '📋 My progress', 'pcm' => '📋 My progress'],
        'btn_accept' => ['en' => '✅ Accept quote', 'pcm' => '✅ Accept the quote'],
        'btn_continue' => ['en' => '▶️ Continue', 'pcm' => '▶️ Continue'],
        'pending_q' => ['en' => "I can answer questions about your home once it's live. Here's where you are:", 'pcm' => 'I go fit answer question about your house once e don live. See where you dey now:'],
        'n_accepted' => ['en' => '👍 %s accepted your request. They will book a survey of your home.', 'pcm' => '👍 %s don accept your request. Dem go book time to come check your house.'],
        'n_survey' => ['en' => '📅 Survey booked for %s. Your quote follows after the visit.', 'pcm' => '📅 Dem go come check your house on %s. Your quote go follow after.'],
        'n_quoted' => ['en' => '🧾 Your quote from %s is ready: %s.', 'pcm' => '🧾 Your quote from %s don ready: %s.'],
        'n_approved_loan' => ['en' => '🏦 Access approved your solar loan of %s. %s will now book your install.', 'pcm' => '🏦 Access don approve your solar loan of %s. %s go book your install now.'],
        'n_approved_cash' => ['en' => '✅ Quote accepted. %s will now book your install.', 'pcm' => '✅ You don accept the quote. %s go book your install now.'],
        'n_referred' => ['en' => '🏦 Access wants to review your loan, so we continue with your quote as cash for now. %s will book your install.', 'pcm' => '🏦 Access wan review your loan, so we go continue your quote as cash for now. %s go book your install.'],
        'n_visit' => ['en' => '📅 %s will visit on %s to check your inverter and generator.', 'pcm' => '📅 %s go come on %s to check your inverter and gen.'],
        'n_certified' => ['en' => "🎉 Your home is certified and live on KlimateX, %s!\n\nYour readings are coming in. Use the buttons below any time: your home, payouts, certificate, or just ask me a question.", 'pcm' => "🎉 Dem don certify your house, e don live for KlimateX, %s!\n\nYour readings don dey enter. Use the buttons for down anytime: your house, your money, certificate, or just ask me question."],
    ];

    public function __construct(
        private TelegramService $bot,
        private OnboardingService $onboarding = new OnboardingService(),
        private Catalog $catalog = new Catalog(),
    ) {
    }

    public static function t(string $lang, string $key, ...$args): string
    {
        $row = self::T[$key] ?? [];
        $text = $row[$lang] ?? $row['en'] ?? $key;
        return $args ? vsprintf($text, $args) : $text;
    }

    // ----- State -----

    public static function state(string $chatId): ?array
    {
        $state = jdec(KvStore::get("telegram:onb:$chatId") ?? '') ?: null;
        return $state && ($state['exp'] ?? 0) >= time() ? $state : null;
    }

    private static function save(string $chatId, array $state): void
    {
        KvStore::set("telegram:onb:$chatId", jenc(array_diff_key($state, ['exp' => 1]) + ['exp' => time() + self::STATE_TTL]));
    }

    public static function clear(string $chatId): void
    {
        KvStore::set("telegram:onb:$chatId", '{}');
    }

    /** True while this household's home is not yet certified. */
    public static function pending(int $householdId): bool
    {
        $status = Database::val('SELECT status FROM onboardings WHERE household_id = ?', [$householdId]);
        return $status !== null && $status !== false && $status !== 'certified';
    }

    // ----- Entry points from TelegramService -----

    public function welcome(string $chatId, string $lang): void
    {
        self::clear($chatId);
        $this->send($chatId, self::t($lang, 'welcome'), ['inline_keyboard' => [
            [['text' => self::t($lang, 'btn_start'), 'callback_data' => 'o:start']],
            [['text' => self::t($lang, 'btn_what'), 'callback_data' => 'o:what']],
            [['text' => self::t($lang, 'btn_account'), 'callback_data' => 'login']],
        ]]);
    }

    /** Typed text while a step waits for it. Returns false when no step was waiting. */
    public function onText(string $chatId, string $text, string $lang, ?array $link): bool
    {
        $state = self::state($chatId);
        if (!$state || !in_array($state['step'] ?? '', ['name', 'area', 'serial'], true)) {
            return false;
        }
        match ($state['step']) {
            'name' => $this->gotName($chatId, $state, $text, $lang),
            'area' => $this->gotArea($chatId, $state, $text, $lang),
            'serial' => $this->gotSerial($chatId, $text, $link),
        };
        return true;
    }

    /** A shared contact while the account step waits for it. Returns false when it wasn't expected. */
    public function onContact(string $chatId, array $message, string $lang): bool
    {
        $state = self::state($chatId);
        if (($state['step'] ?? '') !== 'contact') {
            return false;
        }
        $contact = $message['contact'];
        if ((string) ($contact['user_id'] ?? '') !== (string) ($message['from']['id'] ?? '-')) {
            $this->send($chatId, self::t($lang, 'own_number'));
            return true;
        }
        try {
            $phone = PhoneAuthService::normalise((string) ($contact['phone_number'] ?? ''));
        } catch (HttpException $e) {
            $this->send($chatId, $e->getMessage(), ['remove_keyboard' => true]);
            return true;
        }
        if ((new HouseholdRepository())->findByPhone($phone)) {
            self::clear($chatId);
            $this->bot->awaitPin($chatId, $phone, self::t($lang, 'has_account'));
            return true;
        }
        $first = trim((string) ($contact['first_name'] ?? $message['from']['first_name'] ?? ''));
        $this->askName($chatId, ['phone' => $phone, 'first' => mb_substr($first, 0, 40)] + $state, $lang);
        return true;
    }

    /** "o:..." buttons. */
    public function onButton(string $chatId, string $data, string $lang, ?array $link): void
    {
        $parts = explode(':', $data);
        $arg = $parts[2] ?? '';
        $state = self::state($chatId) ?? [];
        match ($parts[1] ?? '') {
            'what' => $this->send($chatId, self::t($lang, 'what'), ['inline_keyboard' => [[['text' => self::t($lang, 'btn_start'), 'callback_data' => 'o:start']]]]),
            'start' => $this->askSolar($chatId, $lang),
            'need' => $this->packages($chatId, $lang),
            'pkg' => $this->package($chatId, (int) $arg, $lang),
            'pay' => $this->pay($chatId, $state, $arg, $lang),
            'have' => $this->perks($chatId, $lang),
            'hgo' => $this->askContact($chatId, ['path' => 'have'], $lang, self::t($lang, 'share_have')),
            'nm' => isset($state['first']) && ($state['step'] ?? '') === 'name' ? $this->gotName($chatId, $state, $state['first'], $lang) : $this->askSolar($chatId, $lang),
            'area' => ($state['step'] ?? '') === 'area' ? $this->gotArea($chatId, $state, $arg, $lang) : $this->askSolar($chatId, $lang),
            'inc' => $this->step($chatId, $link, fn ($hh) => $this->onboarding->answer($hh, ['income_band' => $arg])),
            'send' => $this->step($chatId, $link, fn ($hh) => $this->onboarding->submit($hh, null)),
            'brand' => $this->step($chatId, $link, fn ($hh) => $this->onboarding->answer($hh, ['inverter_brand' => $arg])),
            'gen' => $this->step($chatId, $link, fn ($hh) => $this->onboarding->answer($hh, ['generator' => $arg])),
            'inst' => $this->step($chatId, $link, fn ($hh) => $this->onboarding->submit($hh, (int) $arg)),
            'accept' => $this->step($chatId, $link, fn ($hh) => $this->onboarding->acceptQuote($hh), false),
            'track' => $link ? $this->tracker($chatId, $link) : $this->askSolar($chatId, $lang),
            'go' => $link ? $this->continue($chatId, $link, $this->onboarding->mine((int) $link['household_id'])) : $this->askSolar($chatId, $lang),
            default => $this->welcome($chatId, $lang),
        };
    }

    // ----- Before the account -----

    private function askSolar(string $chatId, string $lang): void
    {
        $this->send($chatId, self::t($lang, 'ask_solar'), ['inline_keyboard' => [
            [['text' => self::t($lang, 'btn_need'), 'callback_data' => 'o:need']],
            [['text' => self::t($lang, 'btn_have'), 'callback_data' => 'o:have']],
            [['text' => self::t($lang, 'btn_what'), 'callback_data' => 'o:what']],
        ]]);
    }

    private function packages(string $chatId, string $lang): void
    {
        $list = $this->catalog->list();
        $n = fn ($v) => BotCards::naira($v);
        $lines = ['☀️ <b>' . self::t($lang, 'packages_title') . '</b>', ''];
        if ($list['price_range_naira'] && $list['family_home_range_naira']) {
            $lines[] = self::t($lang, 'packages_range', $n($list['price_range_naira'][0]), $n($list['price_range_naira'][1]),
                $n($list['family_home_range_naira'][0]), $n($list['family_home_range_naira'][1]));
            $lines[] = '';
        }
        $buttons = [];
        foreach ($list['installers'] as $i) {
            $badge = $i['metered_homes'] > 0 && $i['average_trust_score'] !== null
                ? self::t($lang, 'metered', $i['metered_homes'], $i['average_trust_score']) : self::t($lang, 'new_installer');
            $lines[] = '🏷 <b>' . BotCards::e($i['name']) . '</b> · ' . BotCards::e((string) $i['area']) . ' · <i>' . $badge . '</i>';
            foreach ($i['packages'] as $p) {
                $lines[] = sprintf('   • %s: %s kVA, %s kWh battery, %d panels · <b>%s–%s</b>', BotCards::e($p['name']),
                    self::num($p['inverter_kva']), self::num($p['battery_kwh']), $p['panels'], $n($p['price_min_naira']), $n($p['price_max_naira']));
                $buttons[] = [['text' => mb_substr($i['name'], 0, 18) . ' · ' . $p['name'], 'callback_data' => 'o:pkg:' . $p['id']]];
            }
            $lines[] = '';
        }
        $lines[] = '<i>' . BotCards::e($list['note']) . '</i>';
        $lines[] = '';
        $lines[] = self::t($lang, 'packages_pick');
        $buttons[] = [['text' => self::t($lang, 'btn_back'), 'callback_data' => 'o:start']];
        $this->send($chatId, implode("\n", $lines), ['inline_keyboard' => $buttons], true);
    }

    private function package(string $chatId, int $id, string $lang): void
    {
        try {
            $p = $this->catalog->find($id);
        } catch (HttpException $e) {
            $this->packages($chatId, $lang);
            return;
        }
        self::save($chatId, ['path' => 'need', 'package_id' => $p['id']]);
        $lines = [
            '☀️ <b>' . BotCards::e($p['name']) . '</b> · ' . BotCards::e($p['installer']['name']),
            sprintf('%s kVA inverter · %s kWh battery · %d × %dW panels', self::num($p['inverter_kva']), self::num($p['battery_kwh']), $p['panels'], $p['panel_w']),
            '',
            '💰 ' . self::t($lang, 'price') . ': <b>' . BotCards::naira($p['price_min_naira']) . '–' . BotCards::naira($p['price_max_naira']) . '</b>',
            '🔌 ' . self::t($lang, 'powers') . ': ' . BotCards::e((string) $p['powers']),
            '',
            ...$this->estimateLines($p['estimate'], $lang),
            '',
            self::t($lang, 'how_pay'),
        ];
        $this->send($chatId, implode("\n", $lines), ['inline_keyboard' => [
            [['text' => self::t($lang, 'btn_cash'), 'callback_data' => 'o:pay:cash'], ['text' => self::t($lang, 'btn_loan'), 'callback_data' => 'o:pay:loan']],
            [['text' => self::t($lang, 'btn_all'), 'callback_data' => 'o:need']],
        ]], true);
    }

    private function pay(string $chatId, array $state, string $payment, string $lang): void
    {
        if (empty($state['package_id']) || !in_array($payment, ['cash', 'loan'], true)) {
            $this->packages($chatId, $lang);
            return;
        }
        $installer = $this->catalog->find((int) $state['package_id'])['installer']['name'];
        $this->askContact($chatId, ['path' => 'need', 'package_id' => (int) $state['package_id'], 'payment' => $payment], $lang, self::t($lang, 'share_need', $installer));
    }

    private function perks(string $chatId, string $lang): void
    {
        $lines = [self::t($lang, 'perks'), '', ...$this->estimateLines(Catalog::estimate(1.6), $lang)];
        $this->send($chatId, implode("\n", $lines), ['inline_keyboard' => [
            [['text' => self::t($lang, 'btn_connect'), 'callback_data' => 'o:hgo']],
            [['text' => self::t($lang, 'btn_back'), 'callback_data' => 'o:start']],
        ]], true);
    }

    private function askContact(string $chatId, array $state, string $lang, string $text): void
    {
        self::save($chatId, $state + ['step' => 'contact']);
        $this->send($chatId, $text, ['keyboard' => [[['text' => self::t($lang, 'btn_share'), 'request_contact' => true]]],
            'resize_keyboard' => true, 'one_time_keyboard' => true]);
    }

    private function askName(string $chatId, array $state, string $lang): void
    {
        self::save($chatId, array_merge($state, ['step' => 'name']));
        $markup = ($state['first'] ?? '') !== ''
            ? ['inline_keyboard' => [[['text' => self::t($lang, 'btn_use_name', $state['first']), 'callback_data' => 'o:nm']]]]
            : ['remove_keyboard' => true];
        if (isset($markup['inline_keyboard'])) {
            // Take the phone keyboard away first; a message can carry only one keyboard.
            $this->send($chatId, '👍', ['remove_keyboard' => true]);
        }
        $this->send($chatId, self::t($lang, 'ask_name'), $markup);
    }

    private function gotName(string $chatId, array $state, string $name, string $lang): void
    {
        $name = trim(preg_replace('/\s+/', ' ', $name));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 60) {
            $this->send($chatId, 'Enter your name, between 2 and 60 characters.');
            return;
        }
        self::save($chatId, array_merge($state, ['name' => $name, 'step' => 'area']));
        $rows = array_chunk(array_map(fn ($a) => ['text' => $a, 'callback_data' => "o:area:$a"], self::AREAS), 3);
        $this->send($chatId, self::t($lang, 'ask_area'), ['inline_keyboard' => $rows]);
    }

    /** The last answer before the account: create it, link this chat, and go on to the next step. */
    private function gotArea(string $chatId, array $state, string $area, string $lang): void
    {
        try {
            $user = $this->onboarding->createAccount(['phone' => $state['phone'] ?? '', 'name' => $state['name'] ?? '', 'area' => $area,
                'path' => $state['path'] ?? '', 'package_id' => $state['package_id'] ?? null, 'payment' => $state['payment'] ?? null], 'telegram');
        } catch (HttpException $e) {
            if ($e->status === 422 && in_array('area', $e->fields, true)) {
                $this->send($chatId, $e->getMessage());
                return;
            }
            self::clear($chatId);
            $this->send($chatId, $e->getMessage(), ['remove_keyboard' => true]);
            return;
        }
        self::clear($chatId);
        $link = $this->bot->linkChat($chatId, (int) $user['id'], (int) $user['household_id'], $lang);
        $this->send($chatId, self::t($lang, 'created', $user['name']));
        $this->continue($chatId, $link, $this->onboarding->mine((int) $user['household_id']));
    }

    // ----- After the account -----

    private function gotSerial(string $chatId, string $text, ?array $link): void
    {
        if (!$link) {
            self::clear($chatId);
            return;
        }
        $this->step($chatId, $link, function ($hh) use ($chatId, $text) {
            $view = $this->onboarding->answer($hh, ['inverter_serial' => $text]);
            self::clear($chatId);
            return $view;
        });
    }

    /** Runs one step for a linked household, then shows what comes next. Errors are shown, the step stays. */
    private function step(string $chatId, ?array $link, callable $fn, bool $show = true): void
    {
        if (!$link) {
            $this->askSolar($chatId, 'en');
            return;
        }
        try {
            $view = $fn((int) $link['household_id']);
        } catch (HttpException $e) {
            $this->send($chatId, $e->getMessage());
            return;
        }
        if ($show) {
            $this->continue($chatId, $link, $view);
        }
    }

    /** Asks for whatever the family still has to do; otherwise shows the tracker. */
    public function continue(string $chatId, array $link, array $view): void
    {
        $lang = $link['lang'];
        $action = $view['next']['action'] ?? null;
        $installer = $view['installer']['name'] ?? '';
        match ($action) {
            'loan_check' => $this->send($chatId, self::t($lang, 'loan_ask'), ['inline_keyboard' => array_map(
                fn ($k, $b) => [['text' => $b['label'], 'callback_data' => "o:inc:$k"]], array_keys(OnboardingService::INCOME_BANDS), OnboardingService::INCOME_BANDS)]),
            'send_request' => $this->send($chatId, implode("\n\n", array_filter([
                $view['loan'] ? self::t($lang, 'loan_result', BotCards::naira($view['loan']['limit_naira']), $view['loan']['months'], BotCards::naira($view['loan']['monthly_naira']),
                    $view['package']['name'], BotCards::naira($view['package']['price_min_naira']), BotCards::naira($view['package']['price_max_naira'])) : null,
                self::t($lang, 'send_ask', $installer)])),
                ['inline_keyboard' => [[['text' => self::t($lang, 'btn_send'), 'callback_data' => 'o:send']]]]),
            'link_inverter' => $view['inverter']['brand']
                ? $this->askSerial($chatId, $lang)
                : $this->send($chatId, self::t($lang, 'brand_ask'), ['inline_keyboard' => array_chunk(array_map(
                    fn ($b) => ['text' => $b, 'callback_data' => "o:brand:$b"], OnboardingService::INVERTER_BRANDS), 3)]),
            'generator' => $this->send($chatId, self::t($lang, 'gen_ask'), ['inline_keyboard' => [
                [['text' => self::t($lang, 'gen_trade_in'), 'callback_data' => 'o:gen:trade_in']],
                [['text' => self::t($lang, 'gen_backup'), 'callback_data' => 'o:gen:backup']],
                [['text' => self::t($lang, 'gen_none'), 'callback_data' => 'o:gen:none']]]]),
            'pick_installer' => $this->send($chatId, self::t($lang, 'inst_ask'), ['inline_keyboard' => array_map(
                fn ($i) => [['text' => $i['name'] . ' · ' . $i['area'], 'callback_data' => 'o:inst:' . $i['id']]], $this->catalog->list()['installers'])]),
            default => $this->tracker($chatId, $link, $view),
        };
    }

    private function askSerial(string $chatId, string $lang): void
    {
        self::save($chatId, ['step' => 'serial']);
        $this->send($chatId, self::t($lang, 'serial_ask'));
    }

    /** Where the family is, what happens next and who does it, and their estimate. */
    public function tracker(string $chatId, array $link, ?array $view = null, ?string $intro = null): void
    {
        $lang = $link['lang'];
        $view ??= $this->onboarding->mine((int) $link['household_id']);
        $lines = array_filter([$intro, '📋 <b>' . self::t($lang, 'tracker') . '</b>']);
        if ($view['package']) {
            $lines[] = '☀️ ' . BotCards::e($view['package']['name']) . ' · ' . BotCards::e($view['installer']['name'] ?? '');
        } elseif ($view['inverter']['serial']) {
            $lines[] = '🔗 ' . BotCards::e((string) $view['inverter']['brand']) . ' ' . BotCards::e($view['inverter']['serial'])
                . ($view['installer'] ? ' · ' . BotCards::e($view['installer']['name']) : '');
        }
        $lines[] = '';
        foreach ($view['steps'] as $s) {
            $icon = $s['done'] ? '✅' : ($s['current'] ? '⏳' : '▫️');
            $lines[] = $icon . ' ' . BotCards::e($s['label']) . ($s['done'] && $s['at'] ? ' <i>' . substr($s['at'], 0, 10) . '</i>' : '');
        }
        if ($view['next']['text'] !== '') {
            $lines[] = '';
            $lines[] = '👉 <b>' . self::t($lang, 'next') . ':</b> ' . BotCards::e($view['next']['text']);
        }
        if (!$view['certified']) {
            $lines[] = '';
            $lines = [...$lines, ...$this->estimateLines($view['estimate'], $lang)];
            $lines[] = '';
            $lines[] = self::t($lang, 'locked');
        }
        $buttons = [];
        if (($view['next']['action'] ?? null) === 'accept_quote') {
            $buttons[] = [['text' => self::t($lang, 'btn_accept'), 'callback_data' => 'o:accept']];
        } elseif (($view['next']['by'] ?? null) === 'family') {
            $buttons[] = [['text' => self::t($lang, 'btn_continue'), 'callback_data' => 'o:go']];
        }
        $buttons[] = [['text' => self::t($lang, 'btn_progress'), 'callback_data' => 'o:track'], ['text' => BotText::t($lang, 'btn_lang'), 'callback_data' => 'langs']];
        $this->send($chatId, implode("\n", $lines), ['inline_keyboard' => $buttons], true);
    }

    /** The menu for a chat whose home is not certified yet. */
    public static function menu(string $lang): array
    {
        return ['inline_keyboard' => [[['text' => self::t($lang, 'btn_progress'), 'callback_data' => 'o:track'], ['text' => BotText::t($lang, 'btn_lang'), 'callback_data' => 'langs']]]];
    }

    /** Tells the family's chats what the installer (or Access) just did. */
    public static function notice(array $view, string $status, string $lang, string $name): ?array
    {
        $installer = $view['installer']['name'] ?? 'Your installer';
        $naira = fn ($v) => BotCards::naira((float) $v);
        $day = $view['survey_on'] ? gmdate('j M Y', strtotime($view['survey_on'])) : '';
        return match ($status) {
            'accepted' => ['text' => self::t($lang, 'n_accepted', $installer)],
            'survey' => ['text' => self::t($lang, 'n_survey', $day)],
            'quoted' => ['text' => self::t($lang, 'n_quoted', $installer, $naira($view['quote_naira'])), 'markup' => ['inline_keyboard' => [
                [['text' => self::t($lang, 'btn_accept'), 'callback_data' => 'o:accept']],
                [['text' => self::t($lang, 'btn_progress'), 'callback_data' => 'o:track']]]]],
            'approved' => ['text' => match (true) {
                ($view['loan']['status'] ?? null) === 'approved' => self::t($lang, 'n_approved_loan', $naira($view['loan']['limit_naira']), $installer),
                ($view['loan']['status'] ?? null) === 'referred' => self::t($lang, 'n_referred', $installer),
                default => self::t($lang, 'n_approved_cash', $installer),
            }],
            'visit' => ['text' => self::t($lang, 'n_visit', $installer, $day)],
            'certified' => ['text' => self::t($lang, 'n_certified', $name), 'certified' => true],
            default => null,
        };
    }

    private function estimateLines(array $e, string $lang): array
    {
        return [
            '📈 <b>' . self::t($lang, 'estimate_title') . '</b>',
            '☀️ ' . self::t($lang, 'est_solar') . ': <b>' . number_format($e['solar_kwh_year']) . ' kWh</b>',
            '⛽ ' . self::t($lang, 'est_petrol') . ': <b>' . number_format($e['petrol_litres_year']) . ' L</b>',
            '💸 ' . self::t($lang, 'est_carbon') . ': <b>' . BotCards::naira($e['family_carbon_naira_year']) . '</b>',
            '<i>' . self::t($lang, 'est_note') . '</i>',
        ];
    }

    private static function num(float $v): string
    {
        return rtrim(rtrim(number_format($v, 1), '0'), '.');
    }

    private function send(string $chatId, string $text, ?array $markup = null, bool $html = false): void
    {
        $params = ['chat_id' => $chatId, 'text' => mb_substr($text, 0, 4000), 'disable_web_page_preview' => true];
        if ($html) {
            $params['parse_mode'] = 'HTML';
        }
        if ($markup !== null) {
            $params['reply_markup'] = $markup;
        }
        TelegramService::api('sendMessage', $params);
    }
}

<?php

namespace App\Services\Telegram;

/**
 * Everything the bot itself says, in the five languages families choose from.
 * The assistant's answers come from the model in the same language; this covers the menus,
 * cards, prompts and alerts, so the chat stays in one language even without a model.
 */
final class BotText
{
    public const LANGS = ['en' => 'English', 'pcm' => 'Pidgin', 'yo' => 'Yorùbá', 'ig' => 'Igbo', 'ha' => 'Hausa'];

    private const T = [
        // Menu
        'btn_home' => ['en' => '🏠 My home', 'pcm' => '🏠 My house', 'yo' => '🏠 Ilé mi', 'ig' => '🏠 Ụlọ m', 'ha' => '🏠 Gidana'],
        'btn_payouts' => ['en' => '💸 Payouts', 'pcm' => '💸 My money', 'yo' => '💸 Owó mi', 'ig' => '💸 Ego m', 'ha' => '💸 Kuɗina'],
        'btn_tips' => ['en' => '🌱 Earn more', 'pcm' => '🌱 Make more money', 'yo' => '🌱 Jèrè sí i', 'ig' => '🌱 Rite karịa', 'ha' => '🌱 Ƙara samu'],
        'btn_audit' => ['en' => '🔍 Audit', 'pcm' => '🔍 Audit', 'yo' => '🔍 Àyẹ̀wò', 'ig' => '🔍 Nyocha', 'ha' => '🔍 Bincike'],
        'btn_cert' => ['en' => '📜 Certificate', 'pcm' => '📜 Certificate', 'yo' => '📜 Ìwé-ẹ̀rí', 'ig' => '📜 Asambodo', 'ha' => '📜 Takardar shaida'],
        'btn_msg' => ['en' => '💬 This month', 'pcm' => '💬 This month', 'yo' => '💬 Oṣù yìí', 'ig' => '💬 Ọnwa a', 'ha' => '💬 Wannan wata'],
        'btn_lang' => ['en' => '🌍 Language', 'pcm' => '🌍 Language', 'yo' => '🌍 Èdè', 'ig' => '🌍 Asụsụ', 'ha' => '🌍 Harshe'],

        // Conversation
        'connected' => [
            'en' => "Hi %s! 🎉 This chat is now connected to your KlimateX home %s.\n\nTap a button below, or just ask me anything about your solar, payouts, audit or loan. I only read your records; I can't move money.",
            'pcm' => "How far %s! 🎉 This chat don connect to your KlimateX house %s.\n\nPress any button for down, or ask me anything about your solar, your money, audit or loan. I fit only read your records; I no fit move money.",
            'yo' => "Ẹ n lẹ́ o %s! 🎉 Ìjíròrò yìí ti so mọ́ ilé KlimateX rẹ %s.\n\nTẹ bọ́tìnnì kan nísàlẹ̀, tàbí bi mí ní ohunkóhun nípa sólá rẹ, owó rẹ, àyẹ̀wò tàbí gbèsè rẹ. Mo lè ka àkọsílẹ̀ rẹ nìkan; n kò lè gbé owó.",
            'ig' => "Ndewo %s! 🎉 Mkparịta ụka a ejikọtala na ụlọ KlimateX gị %s.\n\nPịa bọtịnụ dị n'okpuru, ma ọ bụ jụọ m ihe ọ bụla gbasara sola gị, ego gị, nyocha ma ọ bụ mbinye ego gị. Ana m agụ naanị ndekọ gị; enweghị m ike ibufe ego.",
            'ha' => "Sannu %s! 🎉 An haɗa wannan hira da gidanka na KlimateX %s.\n\nDanna maɓalli a ƙasa, ko ka tambaye ni komai game da hasken rana, kuɗinka, bincike ko bashin ka. Ina karanta bayananka kawai; ba zan iya tura kuɗi ba.",
        ],
        'ready' => [
            'en' => "You're connected ✅ Tap a button or ask me anything.",
            'pcm' => 'You don connect ✅ Press button or ask me anything.',
            'yo' => 'O ti so pọ̀ ✅ Tẹ bọ́tìnnì kan tàbí bi mí ní ohunkóhun.',
            'ig' => 'Ejikọtala gị ✅ Pịa bọtịnụ ma ọ bụ jụọ m ihe ọ bụla.',
            'ha' => 'An haɗa ka ✅ Danna maɓalli ko ka tambaye ni komai.',
        ],
        'pick_lang' => ['en' => 'Choose your language:', 'pcm' => 'Pick the language wey you want:', 'yo' => 'Yan èdè rẹ:', 'ig' => 'Họrọ asụsụ gị:', 'ha' => 'Zaɓi harshenka:'],
        'lang_set' => [
            'en' => "Done ✅ I'll speak English now. Ask me anything about your home.",
            'pcm' => 'Na so ✅ I go dey yarn Pidgin now. Ask me anything about your house.',
            'yo' => 'Ó ti dára ✅ Màá máa sọ Yorùbá báyìí. Bi mí ní ohunkóhun nípa ilé rẹ.',
            'ig' => 'Ọ dị mma ✅ Aga m asụ Igbo ugbu a. Jụọ m ihe ọ bụla gbasara ụlọ gị.',
            'ha' => 'To ✅ Zan riƙa magana da Hausa yanzu. Tambaye ni komai game da gidanka.',
        ],
        'help' => [
            'en' => "Ask me anything about your home: solar, payouts, audit, loan, or how to earn more. Tap 📜 Certificate for your Home Energy Certificate. I can only read your records; I can't move money or change anything. Send /stop to disconnect this chat.",
            'pcm' => 'Ask me anything about your house: solar, your money, audit, loan, or how you fit make more. Press 📜 Certificate to collect your certificate. I fit only read your records; I no fit move money or change anything. Send /stop to comot this chat.',
            'yo' => 'Bi mí ní ohunkóhun nípa ilé rẹ: sólá, owó, àyẹ̀wò, gbèsè, tàbí bí o ṣe lè jèrè sí i. Tẹ 📜 fún ìwé-ẹ̀rí ilé rẹ. Mo lè ka àkọsílẹ̀ rẹ nìkan; n kò lè gbé owó tàbí yí nǹkan padà. Fi /stop ránṣẹ́ láti yọ ìjíròrò yìí kúrò.',
            'ig' => 'Jụọ m ihe ọ bụla gbasara ụlọ gị: sola, ego, nyocha, mbinye ego, ma ọ bụ otu ị ga-esi rite karịa. Pịa 📜 maka asambodo ụlọ gị. Ana m agụ naanị ndekọ gị; enweghị m ike ibufe ego ma ọ bụ gbanwee ihe ọ bụla. Zipu /stop iji kwụsị mkparịta ụka a.',
            'ha' => 'Tambaye ni komai game da gidanka: hasken rana, kuɗi, bincike, bashi, ko yadda za ka ƙara samu. Danna 📜 don takardar shaidar gidanka. Ina karanta bayananka kawai; ba zan iya tura kuɗi ko canza komai ba. Aika /stop don cire wannan hira.',
        ],
        'text_only' => [
            'en' => 'I can read text and listen to voice notes. Type or say your question, or tap a button below.',
            'pcm' => 'I fit read text and hear voice note. Type or talk your question, or press button for down.',
            'yo' => 'Mo lè ka ọ̀rọ̀ àti gbọ́ ohùn. Kọ tàbí sọ ìbéèrè rẹ, tàbí tẹ bọ́tìnnì kan nísàlẹ̀.',
            'ig' => 'Enwere m ike ịgụ ederede na ige ozi olu. Dee ma ọ bụ kwuo ajụjụ gị, ma ọ bụ pịa bọtịnụ dị n\'okpuru.',
            'ha' => 'Ina iya karanta rubutu da sauraron saƙon murya. Rubuta ko faɗi tambayarka, ko danna maɓalli a ƙasa.',
        ],
        'cert_caption' => [
            'en' => '📜 Your Home Energy Certificate, %s. Grade %s before solar, %s now. Keep it, print it, or share it.',
            'pcm' => '📜 Your house energy certificate, %s. Grade %s before solar, %s now. Keep am, print am, or share am.',
            'yo' => '📜 Ìwé-ẹ̀rí agbára ilé rẹ, %s. Ipele %s ṣáájú sólá, %s báyìí. Pa á mọ́, tẹ̀ ẹ́ jáde, tàbí pín in.',
            'ig' => '📜 Asambodo ike ụlọ gị, %s. Ọkwa %s tupu sola, %s ugbu a. Debe ya, bipụta ya, ma ọ bụ kesaa ya.',
            'ha' => '📜 Takardar shaidar makamashin gidanka, %s. Matsayi %s kafin hasken rana, %s yanzu. Ajiye ta, buga ta, ko raba ta.',
        ],

        // Home card
        'home_title' => ['en' => 'My home', 'pcm' => 'My house', 'yo' => 'Ilé mi', 'ig' => 'Ụlọ m', 'ha' => 'Gidana'],
        'grade' => ['en' => 'Energy grade', 'pcm' => 'Energy grade', 'yo' => 'Ipele agbára', 'ig' => 'Ọkwa ike', 'ha' => 'Matsayin makamashi'],
        'before' => ['en' => 'before solar', 'pcm' => 'before solar', 'yo' => 'ṣáájú sólá', 'ig' => 'tupu sola', 'ha' => 'kafin hasken rana'],
        'now' => ['en' => 'now', 'pcm' => 'now', 'yo' => 'báyìí', 'ig' => 'ugbu a', 'ha' => 'yanzu'],
        'co2' => ['en' => 'CO₂ cut this period', 'pcm' => 'CO₂ wey you cut this period', 'yo' => 'CO₂ tí o dín kù ní àsìkò yìí', 'ig' => 'CO₂ ị belatara n\'oge a', 'ha' => 'CO₂ da ka rage a wannan lokaci'],
        'petrol' => ['en' => 'Petrol not burned', 'pcm' => 'Fuel wey you no burn', 'yo' => 'Epo tí o kò jó', 'ig' => 'Mmanụ ụgbọ ị na-esighị', 'ha' => 'Man fetur da ba ka ƙona ba'],
        'paid_total' => ['en' => 'Paid to you so far', 'pcm' => 'Money wey don reach you', 'yo' => 'Owó tí o ti gbà', 'ig' => 'Ego e kwụrụla gị', 'ha' => 'Kuɗin da aka biya ka zuwa yanzu'],
        'trust' => ['en' => 'Trust score', 'pcm' => 'Trust score', 'yo' => 'Àmì ìgbẹ́kẹ̀lé', 'ig' => 'Akara ntụkwasị obi', 'ha' => 'Makin amana'],
        'solar_months' => ['en' => 'Solar made, month by month', 'pcm' => 'Solar wey you make, month by month', 'yo' => 'Agbára sólá, oṣù dé oṣù', 'ig' => 'Ike sola, ọnwa n\'ọnwa', 'ha' => 'Hasken rana da aka samu, wata-wata'],
        'next_step' => ['en' => 'Next step', 'pcm' => 'Next step', 'yo' => 'Ìgbésẹ̀ tó kàn', 'ig' => 'Nzọụkwụ ọzọ', 'ha' => 'Mataki na gaba'],

        // Payouts card
        'payouts_title' => ['en' => 'Your payouts', 'pcm' => 'Your money', 'yo' => 'Owó rẹ', 'ig' => 'Ego gị', 'ha' => 'Kuɗinka'],
        'to_loan' => ['en' => 'to your solar loan', 'pcm' => 'enter your solar loan', 'yo' => 'sí gbèsè sólá rẹ', 'ig' => 'na mbinye ego sola gị', 'ha' => 'zuwa bashin hasken ranarka'],
        'to_wallet' => ['en' => 'to your wallet', 'pcm' => 'enter your wallet', 'yo' => 'sí àpò owó rẹ', 'ig' => 'na obere akpa ego gị', 'ha' => 'zuwa walat ɗinka'],
        'to_bank' => ['en' => 'to your bank account', 'pcm' => 'enter your bank account', 'yo' => 'sí àkáǹtì báńkì rẹ', 'ig' => 'na akaụntụ ụlọ akụ gị', 'ha' => 'zuwa asusun bankinka'],
        'next_pay' => [
            'en' => 'Next payment: about %s after the audit closing %s (an estimate, not a promise).',
            'pcm' => 'Next money: like %s after the audit wey go close %s (na estimate, no be promise).',
            'yo' => 'Owó tó kàn: nǹkan bí %s lẹ́yìn àyẹ̀wò tó parí %s (ìfojúsùn ni, kì í ṣe ìlérí).',
            'ig' => 'Ego ọzọ: ihe dị ka %s mgbe nyocha mechiri %s (atụmatụ, ọ bụghị nkwa).',
            'ha' => 'Biya na gaba: kusan %s bayan binciken da zai rufe %s (kiyasi ne, ba alkawari ba).',
        ],
        'no_payouts' => ['en' => 'No payouts yet.', 'pcm' => 'No money don come yet.', 'yo' => 'Kò sí owó kankan síbẹ̀.', 'ig' => 'Enwebeghị ego ọ bụla.', 'ha' => 'Babu biya tukuna.'],

        // Audit card
        'audit_title' => ['en' => 'Latest audit', 'pcm' => 'Latest audit', 'yo' => 'Àyẹ̀wò tó kẹ́yìn', 'ig' => 'Nyocha ikpeazụ', 'ha' => 'Bincike na ƙarshe'],
        'eligible' => ['en' => '✅ Passed: your credits can be issued', 'pcm' => '✅ E pass: dem fit issue your credits', 'yo' => '✅ Ó yege: a lè fún ọ ní kírẹ́dìtì rẹ', 'ig' => '✅ Ọ gafere: enwere ike inye kredit gị', 'ha' => '✅ Ya wuce: za a iya fitar da kiredit ɗinka'],
        'held' => ['en' => '⏸ On hold while we check something', 'pcm' => '⏸ E dey hold as we dey check something', 'yo' => '⏸ Ó dúró nígbà tí a ń ṣàyẹ̀wò nǹkan kan', 'ig' => '⏸ Ọ kwụsịrị ka anyị na-enyocha ihe', 'ha' => '⏸ An dakatar yayin da muke duba wani abu'],
        'excluded' => ['en' => '❌ Not counted this period', 'pcm' => '❌ E no count this period', 'yo' => '❌ A kò kà á ní àsìkò yìí', 'ig' => '❌ Agụghị ya n\'oge a', 'ha' => '❌ Ba a ƙidaya shi a wannan lokaci ba'],
        'checks' => ['en' => 'Checks passed', 'pcm' => 'Checks wey pass', 'yo' => 'Àyẹ̀wò tó yege', 'ig' => 'Nyocha gafere', 'ha' => 'Binciken da suka wuce'],
        'todo' => [
            'en' => '🌱 %d things you can do to earn more. Tap Earn more.',
            'pcm' => '🌱 %d things wey you fit do to make more money. Press Make more money.',
            'yo' => '🌱 Nǹkan %d tí o lè ṣe láti jèrè sí i. Tẹ Jèrè sí i.',
            'ig' => '🌱 Ihe %d ị nwere ike ime iji rite karịa. Pịa Rite karịa.',
            'ha' => '🌱 Abubuwa %d da za ka iya yi don ƙara samu. Danna Ƙara samu.',
        ],

        // Voice notes
        'voice_heard' => ['en' => '🎙 I heard: “%s”', 'pcm' => '🎙 Wetin I hear: “%s”', 'yo' => '🎙 Ohun tí mo gbọ́: “%s”', 'ig' => '🎙 Ihe m nụrụ: “%s”', 'ha' => '🎙 Abin da na ji: “%s”'],
        'voice_unclear' => [
            'en' => "🎙 Sorry, I couldn't make out that voice note. Try again a bit closer to the phone, or type your question.",
            'pcm' => '🎙 Sorry, I no hear that voice note well. Try again near the phone, or type your question.',
            'yo' => '🎙 Má bínú, n kò gbọ́ ohùn yẹn dáadáa. Gbìyànjú lẹ́ẹ̀kan sí i nítòsí fóònù, tàbí kọ ìbéèrè rẹ.',
            'ig' => '🎙 Ndo, anụghị m olu ahụ nke ọma. Nwaa ọzọ nso ekwentị, ma ọ bụ dee ajụjụ gị.',
            'ha' => '🎙 Yi haƙuri, ban ji saƙon muryar sosai ba. Sake gwadawa kusa da wayar, ko ka rubuta tambayarka.',
        ],
        'voice_long' => [
            'en' => '🎙 That voice note is a bit long. Please keep it under 2 minutes.',
            'pcm' => '🎙 That voice note too long small. Make am short pass 2 minutes.',
            'yo' => '🎙 Ohùn yẹn gùn díẹ̀. Jọ̀wọ́ jẹ́ kí ó kéré sí ìṣẹ́jú méjì.',
            'ig' => '🎙 Ozi olu ahụ dị ogologo. Biko mee ka ọ dị n\'okpuru nkeji abụọ.',
            'ha' => '🎙 Saƙon muryar ya ɗan yi tsawo. Don Allah ka sa ya kasa minti biyu.',
        ],
        'voice_off' => [
            'en' => "🎙 I can't listen to voice notes right now. Please type your question.",
            'pcm' => '🎙 I no fit hear voice note now. Abeg type your question.',
            'yo' => '🎙 N kò lè gbọ́ ohùn báyìí. Jọ̀wọ́ kọ ìbéèrè rẹ.',
            'ig' => '🎙 Enweghị m ike ige ozi olu ugbu a. Biko dee ajụjụ gị.',
            'ha' => '🎙 Ba zan iya sauraron saƙon murya yanzu ba. Don Allah ka rubuta tambayarka.',
        ],

        // Payout alert
        'alert_loan' => [
            'en' => "💸 Good news, %s! %s from your carbon credits just paid down your solar loan.\n\nA buyer bought credits made by your solar. Tap Payouts for the details.",
            'pcm' => "💸 Better news, %s! %s from your carbon credits don pay part of your solar loan.\n\nSomebody buy credits wey your solar make. Press My money to see am.",
            'yo' => "💸 Ìròyìn ayọ̀, %s! %s láti inú kírẹ́dìtì erogba rẹ ti san apá kan gbèsè sólá rẹ.\n\nẸnìkan ra kírẹ́dìtì tí sólá rẹ ṣe. Tẹ Owó mi láti rí i.",
            'ig' => "💸 Ozi ọma, %s! %s si na kredit carbon gị akwụọla akụkụ mbinye ego sola gị.\n\nOnye zụrụ kredit sola gị mere. Pịa Ego m maka nkọwa.",
            'ha' => "💸 Albishir, %s! %s daga kiredit ɗin carbon ɗinka ya biya wani ɓangare na bashin hasken ranarka.\n\nWani ya sayi kiredit da hasken ranarka ya samar. Danna Kuɗina don ganin bayani.",
        ],
        'alert_wallet' => [
            'en' => "💸 Good news, %s! %s from your carbon credits just landed in your wallet.\n\nA buyer bought credits made by your solar. Tap Payouts for the details.",
            'pcm' => "💸 Better news, %s! %s from your carbon credits don land for your wallet.\n\nSomebody buy credits wey your solar make. Press My money to see am.",
            'yo' => "💸 Ìròyìn ayọ̀, %s! %s láti inú kírẹ́dìtì erogba rẹ ti wọ àpò owó rẹ.\n\nẸnìkan ra kírẹ́dìtì tí sólá rẹ ṣe. Tẹ Owó mi láti rí i.",
            'ig' => "💸 Ozi ọma, %s! %s si na kredit carbon gị abatala n'akpa ego gị.\n\nOnye zụrụ kredit sola gị mere. Pịa Ego m maka nkọwa.",
            'ha' => "💸 Albishir, %s! %s daga kiredit ɗin carbon ɗinka ya shiga walat ɗinka.\n\nWani ya sayi kiredit da hasken ranarka ya samar. Danna Kuɗina don ganin bayani.",
        ],
        'alert_bank' => [
            'en' => "💸 Good news, %s! %s from your carbon credits just reached your bank account.\n\nA buyer bought credits made by your solar. Tap Payouts for the details.",
            'pcm' => "💸 Better news, %s! %s from your carbon credits don enter your bank account.\n\nSomebody buy credits wey your solar make. Press My money to see am.",
            'yo' => "💸 Ìròyìn ayọ̀, %s! %s láti inú kírẹ́dìtì erogba rẹ ti dé àkáǹtì báńkì rẹ.\n\nẸnìkan ra kírẹ́dìtì tí sólá rẹ ṣe. Tẹ Owó mi láti rí i.",
            'ig' => "💸 Ozi ọma, %s! %s si na kredit carbon gị abatala n'akaụntụ ụlọ akụ gị.\n\nOnye zụrụ kredit sola gị mere. Pịa Ego m maka nkọwa.",
            'ha' => "💸 Albishir, %s! %s daga kiredit ɗin carbon ɗinka ya isa asusun bankinka.\n\nWani ya sayi kiredit da hasken ranarka ya samar. Danna Kuɗina don ganin bayani.",
        ],
    ];

    public static function t(string $lang, string $key, ...$args): string
    {
        $row = self::T[$key] ?? [];
        $text = $row[$lang] ?? $row['en'] ?? $key;
        return $args ? vsprintf($text, $args) : $text;
    }

    public static function lang(?string $code): string
    {
        return isset(self::LANGS[$code ?? '']) ? $code : 'en';
    }
}

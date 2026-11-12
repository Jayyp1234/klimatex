<?php

namespace App\Config;

use RuntimeException;

/** All runtime settings. The same image runs on a laptop (mock, SQLite) and in team20 (live, Postgres). */
final class Settings
{
    public static function mode(): string { return Env::get('MODE', 'mock'); }
    public static function live(): bool { return self::mode() === 'live'; }

    public static function dsn(): string { return Env::get('DB_DSN', 'sqlite:' . sys_get_temp_dir() . '/klimatex.db'); }
    public static function dbUser(): ?string { return Env::get('DB_USER'); }
    public static function dbPass(): ?string { return Env::get('DB_PASS'); }

    public static function gatewayKey(): string { return Env::get('GATEWAY_KEY', ''); }
    public static function bankBase(): string { return Env::get('BANK_BASE_URL', 'http://bank-api.ingress-apisix.svc.cluster.local/v1'); }
    public static function maasBase(): string { return Env::get('MAAS_BASE_URL', 'http://huawei-maas.ingress-apisix.svc.cluster.local/openai/v1'); }
    public static function maasModel(): string { return Env::get('MAAS_MODEL', 'glm-5.2'); }

    /** Claude: used for the assistant and family messages when a key is set (kept in a cluster secret only). */
    public static function anthropicKey(): string { return Env::get('ANTHROPIC_API_KEY', ''); }
    public static function anthropicModel(): string { return Env::get('ANTHROPIC_MODEL', 'claude-opus-5-5'); }
    public static function anthropicBaseUrl(): ?string { return Env::get('ANTHROPIC_BASE_URL'); }

    /** Telegram bot token from @BotFather. Empty: the bot is off. */
    public static function telegramToken(): string { return Env::get('TELEGRAM_BOT_TOKEN', ''); }
    /** The bot's username, for t.me links. Read from Telegram by scripts/telegram.php, or set here. */
    public static function telegramBot(): string { return Env::get('TELEGRAM_BOT_USERNAME', ''); }
    /** whisper.cpp server for Telegram voice notes; empty switches voice notes off. */
    public static function whisperUrl(): string { return Env::get('WHISPER_URL', ''); }

    /** Crediting methodology code; see Carbon::ALL. */
    public static function methodology(): string { return Env::get('METHODOLOGY', 'gs-just-v1'); }

    public static function publicBase(): string { return Env::get('PUBLIC_BASE_URL', 'https://team20.xtradot.co'); }
    public static function webhookUrl(): string { return Env::get('WEBHOOK_URL', 'http://app.team20.svc.cluster.local/hooks/forge'); }

    /** "pending" is the placeholder set before the webhook is registered; it is never a real key. */
    public static function webhookSecret(): string
    {
        $secret = Env::get('WEBHOOK_SECRET', '');
        return $secret === 'pending' ? '' : $secret;
    }

    public static function jwtSecret(): string
    {
        $secret = Env::get('JWT_SECRET', '');
        if (strlen($secret) >= 32) {
            return $secret;
        }
        if (self::live()) {
            throw new RuntimeException('JWT_SECRET must be set to at least 32 characters in live mode');
        }
        return 'klimatex-local-development-only-secret';
    }

    public const JWT_ISSUER = 'klimatex';
    public const ACCESS_TTL_SECONDS = 1800;
    public const REFRESH_TTL_SECONDS = 1209600;
    public const LOGIN_MAX_FAILURES = 5;
    public const LOGIN_WINDOW_SECONDS = 900;
    public const PHONE_CODE_TTL_SECONDS = 600;
    public const PHONE_CODE_MAX_ATTEMPTS = 5;
    public const PHONE_CODES_PER_WINDOW = 5;
    public const SETUP_TTL_SECONDS = 900;

    /** @return string[] */
    public static function allowedOrigins(): array
    {
        $list = Env::get('ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000');
        return array_values(array_filter(array_map('trim', explode(',', $list . ',' . self::publicBase()))));
    }

    /** When set, seeding creates one demo login per role with this password. */
    public static function demoPassword(): ?string { return Env::get('DEMO_PASSWORD'); }

    /** No SMS provider is connected to the sandbox, so sign-in codes are returned to the screen instead. */
    public static function showSmsCodes(): bool { return Env::get('SMS_PROVIDER', 'none') === 'none'; }

    // Sandbox accounts (synthetic test data from the platform guide, section 5.4)
    public const OPERATING_ACCOUNT = '0123456790';
    public const INSTALLER_ACCOUNT = '0123987005';
    public const INSTALLER_BANK_CODE = '000015';
    public const LOAN_APPLICANT_ACCOUNT = '0123456789';
    public const LOAN_APPLICANT_BVN = '22200000001';
    /** Banks a family can be paid into (NIP codes). */
    public const BANKS = [
        '000014' => 'Access Bank', '000013' => 'GTBank', '000015' => 'Zenith Bank', '000016' => 'First Bank',
        '000004' => 'UBA', '000003' => 'FCMB', '000007' => 'Fidelity Bank', '000001' => 'Sterling Bank',
        '100004' => 'OPay', '100033' => 'PalmPay', '090405' => 'Moniepoint', '090267' => 'Kuda',
    ];

    // Carbon engine. Placeholders until confirmed from the JUST annexes.
    public const EF_GENSET = 1.59;
    public const EF_GRID = 0.40;
    public const DAF_NETZERO = 0.05;
    public const EMBODIED_T_SITE_MONTH = 0.01;
    public const LEAKAGE_T_PER_MWH = 1.3;
    public const AVAILABILITY_FACTOR = 0.9;
    public const BACKUP_LIMIT = 0.10;

    // Market: price per credit in kobo (NGN 15,000) and split in basis points
    public const PRICE_PER_CREDIT_KOBO = 1500000;
    public const SPLIT = ['household' => 5000, 'installer' => 1500, 'audit' => 2000];
    public const RESERVATION_MINUTES = 15;
    public const PROJECT_CODE = 'LAG01';
    public const PROJECTS = [
        'LAG01' => ['name' => 'Surulere Household Solar', 'location' => 'Surulere, Lagos', 'state' => 'Lagos', 'country' => 'NG',
            'methodology' => 'Gold Standard JUST: Fossil Fuel Generators v1.0'],
    ];
    // Option 1 money flow (docs/SANDBOX_SPEC_NOTES.md, 5A): buyers pay the registry merchant, the registry
    // retires and pays the project owner, and KlimateX pays the family split from its operating account.
    public const REGISTRY_MERCHANT = 'mer_900';
    public const PROJECT_LOCATION = ['state' => 'Lagos', 'lga' => 'Surulere', 'lat' => 6.498, 'lng' => 3.355];
    // KlimateX owns the project, so the registry pays sale proceeds (less its 2% fee) into the operating
    // account that then pays families, the installer and the audit reserve. The books close on every order.
    // 'name' is the operating account's holder name at the sandbox bank (intra name enquiry), as the registry checks it.
    public const PROJECT_OWNER = ['name' => 'BABATUNDE OLUMIDE ADEYEMI', 'contact_name' => 'KlimateX operations',
        'phone' => '+2348031234508', 'payout_account' => self::OPERATING_ACCOUNT, 'bank_code' => '000014'];
    public const DEMO_LOAN_KOBO = 50000000; // ₦500,000: above ₦1,000,000 the sandbox refers instead of approving
    public const MAX_ORDER_TONNES = 1000;
    public const MAX_PAYOUT_ATTEMPTS = 5;
    public const PAYOUT_CLAIM_SECONDS = 120;
}

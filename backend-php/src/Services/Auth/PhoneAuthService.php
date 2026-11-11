<?php

namespace App\Services\Auth;

use App\Config\Database;
use App\Config\Settings;
use App\Core\HttpException;
use App\Models\AuthTokenRepository;
use App\Models\HouseholdRepository;
use App\Models\PhoneCodeRepository;
use App\Models\UserRepository;

/**
 * How a family signs in: phone number and a 4-digit PIN.
 * The first time, or after a forgotten PIN, a one-time code proves the phone is theirs.
 * The phone must already be on a household: the installer registers it at the visit.
 */
final class PhoneAuthService
{
    private const WEAK_PINS = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210', '1212', '2580', '1004', '2000', '2026'];

    public function __construct(
        private HouseholdRepository $households = new HouseholdRepository(),
        private UserRepository $users = new UserRepository(),
        private PhoneCodeRepository $codes = new PhoneCodeRepository(),
        private AuthTokenRepository $tokens = new AuthTokenRepository(),
        private AuthService $auth = new AuthService(),
    ) {
    }

    /** Accepts 0803 123 4567, 803 123 4567, 234803... or +234803... and returns +2348031234567. */
    public static function normalise(string $input): string
    {
        $digits = preg_replace('/\D+/', '', $input);
        $local = match (true) {
            strlen($digits) === 13 && str_starts_with($digits, '234') => substr($digits, 3),
            strlen($digits) === 11 && $digits[0] === '0' => substr($digits, 1),
            strlen($digits) === 10 && $digits[0] !== '0' => $digits,
            default => null,
        };
        if ($local === null || !in_array($local[0], ['7', '8', '9'], true)) {
            throw new HttpException(422, 'Enter your 11-digit phone number, like 0803 123 4567.', ['phone']);
        }
        return '+234' . $local;
    }

    /** Masks all but the last four digits: 0700 ••• 0012. */
    public static function mask(string $phone): string
    {
        return '0' . substr($phone, 4, 3) . ' ••• ' . substr($phone, -4);
    }

    /** Step 1. Says whether this phone signs in with its PIN or needs a code first. */
    public function start(string $input, bool $forgotPin): array
    {
        $phone = self::normalise($input);
        $household = $this->households->findByPhone($phone)
            ?? throw new HttpException(404, "We can't find a home registered to that number. Your installer adds your phone when they fit your solar, so ask them to check it.", ['phone']);
        $user = $this->users->findForHousehold((int) $household['id']);
        if (!$forgotPin && $user && $user['pin_hash'] && $user['phone'] === $phone) {
            return ['next' => 'pin', 'phone' => self::mask($phone)];
        }
        return ['next' => 'code'] + $this->sendCode($phone);
    }

    /** Step 2. A correct code returns a setup token, good once for 15 minutes, to choose a PIN. */
    public function verify(string $input, string $code): array
    {
        $phone = self::normalise($input);
        $code = preg_replace('/\D+/', '', $code);
        if (strlen($code) !== 6) {
            throw new HttpException(422, 'Enter the 6-digit code we sent you.', ['code']);
        }
        $row = $this->codes->latestOpen($phone);
        if (!$row || $row['expires_at'] < now_iso()) {
            throw new HttpException(410, 'That code has expired. Ask for a new one.', ['code']);
        }
        if ((int) $row['attempts'] >= Settings::PHONE_CODE_MAX_ATTEMPTS) {
            throw new HttpException(429, 'Too many wrong codes. Ask for a new one.', ['code']);
        }
        if (!hash_equals($row['code_hash'], self::hashCode($phone, $code))) {
            $this->codes->addAttempt((int) $row['id']);
            throw new HttpException(401, "That code isn't right. Check the message and try again.", ['code']);
        }
        $token = bin2hex(random_bytes(32));
        $this->codes->markVerified((int) $row['id'], hash('sha256', $token));
        $household = $this->households->findByPhone($phone);
        $user = $household ? $this->users->findForHousehold((int) $household['id']) : null;
        return ['setup_token' => $token, 'name' => $user['name'] ?? $household['name'] ?? '', 'returning' => (bool) ($user['pin_hash'] ?? null)];
    }

    /** Step 3. Sets the PIN (and the name the family wants to be called) and signs them in. */
    public function complete(string $token, string $pin, string $name): array
    {
        if (!preg_match('/^\d{4}$/', $pin)) {
            throw new HttpException(422, 'Your PIN must be 4 digits.', ['pin']);
        }
        if (count(array_unique(str_split($pin))) === 1 || in_array($pin, self::WEAK_PINS, true)) {
            throw new HttpException(422, 'That PIN is too easy to guess. Avoid repeats like 1111 and runs like 1234.', ['pin']);
        }
        $name = trim(preg_replace('/\s+/', ' ', $name));
        if ($name !== '' && (mb_strlen($name) < 2 || mb_strlen($name) > 60)) {
            throw new HttpException(422, 'Enter a name between 2 and 60 characters.', ['name']);
        }
        $row = $token === '' ? null : $this->codes->findBySetup(hash('sha256', $token));
        $fresh = $row && $row['verified_at'] >= gmdate('Y-m-d\TH:i:s\Z', time() - Settings::SETUP_TTL_SECONDS);
        if (!$fresh) {
            throw new HttpException(401, 'This step has timed out. Start again with your phone number.');
        }

        $user = Database::tx(function () use ($row, $pin, $name) {
            if (!$this->codes->spendSetup((int) $row['id'])) {
                throw new HttpException(401, 'This step has already been used. Start again with your phone number.');
            }
            $household = $this->households->findByPhone($row['phone']) ?? throw new HttpException(404, 'This home is no longer registered.');
            $user = $this->users->findForHousehold((int) $household['id']);
            $id = $user ? (int) $user['id'] : $this->users->create(sprintf('home-%d@households.klimatex.test', $household['id']),
                $household['name'], password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), 'household', (int) $household['id']);
            $this->users->setPhoneAccess($id, $row['phone'], password_hash($pin, PASSWORD_DEFAULT), $name !== '' ? $name : ($user['name'] ?? $household['name']));
            return $this->users->find($id);
        });
        $this->tokens->clearFailures(self::failureKey($row['phone']));
        return $this->auth->issue($user);
    }

    /** Everyday sign-in. Five wrong PINs lock the phone for 15 minutes; a code resets it. */
    public function login(string $input, string $pin, string $ip): array
    {
        $phone = self::normalise($input);
        $key = self::failureKey($phone);
        $since = gmdate('Y-m-d\TH:i:s\Z', time() - Settings::LOGIN_WINDOW_SECONDS);
        if ($this->tokens->recentFailures($key, $since) >= Settings::LOGIN_MAX_FAILURES) {
            throw new HttpException(429, 'Too many wrong PINs. Wait 15 minutes, or reset your PIN with a code.');
        }
        $user = $this->users->findByPhone($phone);
        $valid = password_verify($pin, $user['pin_hash'] ?? AuthService::DUMMY_HASH);
        if (!$user || !$user['pin_hash'] || !$valid || !(int) $user['active']) {
            $this->tokens->recordFailure($key, $ip);
            throw new HttpException(401, "That PIN isn't right. Try again, or tap Forgot PIN.", ['pin']);
        }
        $this->tokens->clearFailures($key);
        return $this->auth->issue($user);
    }

    private function sendCode(string $phone): array
    {
        $since = gmdate('Y-m-d\TH:i:s\Z', time() - Settings::LOGIN_WINDOW_SECONDS);
        if ($this->codes->countSince($phone, $since) >= Settings::PHONE_CODES_PER_WINDOW) {
            throw new HttpException(429, 'Too many codes asked for. Wait 15 minutes and try again.');
        }
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->codes->create($phone, self::hashCode($phone, $code), gmdate('Y-m-d\TH:i:s\Z', time() + Settings::PHONE_CODE_TTL_SECONDS));
        // An SMS provider would send the code here. The sandbox has none, so it is shown on screen instead.
        return ['phone' => self::mask($phone), 'expires_in' => Settings::PHONE_CODE_TTL_SECONDS]
            + (Settings::showSmsCodes() ? ['demo_code' => $code] : []);
    }

    private static function hashCode(string $phone, string $code): string
    {
        return hash_hmac('sha256', "$phone:$code", Settings::jwtSecret());
    }

    private static function failureKey(string $phone): string
    {
        return "phone:$phone";
    }
}

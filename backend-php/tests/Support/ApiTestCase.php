<?php

namespace Tests\Support;

use App\Config\Database;
use App\Config\Settings;
use App\Core\Kernel;
use App\Core\Request;
use App\Core\Response;
use App\Migrations\Migrator;
use App\Models\UserRepository;
use App\Services\Bank\Bank;
use App\Services\Market\MarketService;
use App\Services\Period\PeriodService;
use App\Services\Simulator\Simulator;
use PHPUnit\Framework\TestCase;

abstract class ApiTestCase extends TestCase
{
    protected const PASSWORD = 'test-password-123';
    protected Kernel $kernel;
    private array $tokens = [];

    protected function setUp(): void
    {
        Database::reset();
        if (Database::isSqlite()) {
            @unlink(substr(Settings::dsn(), 7));
        } else {
            Database::pdo()->exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
        }
        Migrator::run();
        Bank::swap(null);
        $this->kernel = new Kernel();
    }

    protected function tearDown(): void
    {
        Bank::swap(null);
        Database::reset();
    }

    protected function call(string $method, string $path, ?array $body = null, ?string $as = null, array $query = []): Response
    {
        $headers = $as ? ['Authorization' => 'Bearer ' . $this->token($as)] : [];
        return $this->kernel->handle(new Request($method, $path, $query, $body === null ? '' : jenc($body), $headers, '127.0.0.1'));
    }

    protected function token(string $role): string
    {
        return $this->tokens[$role] ??= $this->login($role)['access_token'];
    }

    protected function login(string $role): array
    {
        $email = ($role === 'household' ? 'adaeze' : $role) . '@demo.klimatex.test';
        $response = $this->kernel->handle(new Request('POST', '/api/auth/login', [], jenc(['email' => $email, 'password' => self::PASSWORD])));
        $this->assertSame(200, $response->status, jenc($response->body));
        return $response->body['data'];
    }

    protected function signedPeriod(): int
    {
        Simulator::seed();
        $periods = new PeriodService();
        $id = $periods->create(Simulator::START, Simulator::END);
        $periods->compute($id);
        foreach ($periods->sample($id, 42)['sample'] as $site) {
            $periods->review($id, $site, 'ok');
        }
        $periods->signOff($id, 'Test Auditor');
        return $id;
    }

    protected function paidOrder(int $tonnes = 5): int
    {
        $buyer = (new UserRepository())->findByEmail('buyer@demo.klimatex.test');
        $order = (new MarketService())->createOrder($buyer['name'], $tonnes, (int) $buyer['id']);
        Bank::client()->payWithTestCard($order['reference']);
        return $order['order'];
    }
}

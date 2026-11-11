<?php

namespace App\Controllers;

use App\Core\Request;
use App\Middleware\AuthMiddleware;
use App\Services\Street\StreetService;

final class StreetController
{
    public function __construct(private StreetService $streets = new StreetService())
    {
    }

    public function index(Request $request): array
    {
        return $this->streets->list();
    }

    public function forHome(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->streets->forSite((int) $id);
    }
}

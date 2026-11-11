<?php

namespace App\Controllers;

use App\Core\Request;
use App\Services\Support\SupportService;

final class SupportController
{
    public function __construct(private SupportService $support = new SupportService())
    {
    }

    public function create(Request $request): array
    {
        return $this->support->create($request->user, $request->body ?? []);
    }

    public function index(Request $request): array
    {
        return $this->support->list($request->user);
    }
}

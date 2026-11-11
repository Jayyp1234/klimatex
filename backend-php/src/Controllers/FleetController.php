<?php

namespace App\Controllers;

use App\Core\Request;
use App\Services\Fleet\FleetService;

final class FleetController
{
    public function __construct(private FleetService $fleet = new FleetService())
    {
    }

    /** Installers see only the homes they fitted; the lender and operations see every home. */
    public function overview(Request $request): array
    {
        $user = $request->user;
        return $this->fleet->overview($user['role'] === 'installer' ? (int) ($user['installer_id'] ?? 0) : null);
    }
}

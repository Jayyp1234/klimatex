<?php

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Services\Auth\AuthService;
use App\Services\Auth\PhoneAuthService;

final class AuthController
{
    public function __construct(private AuthService $auth = new AuthService(), private PhoneAuthService $phone = new PhoneAuthService())
    {
    }

    public function phoneStart(Request $request): array
    {
        return $this->phone->start((string) $request->input('phone', ''), (bool) $request->input('forgot_pin', false));
    }

    public function phoneVerify(Request $request): array
    {
        return $this->phone->verify((string) $request->input('phone', ''), (string) $request->input('code', ''));
    }

    public function phoneComplete(Request $request): array
    {
        return $this->phone->complete((string) $request->input('setup_token', ''), (string) $request->input('pin', ''), (string) $request->input('name', ''));
    }

    public function phoneLogin(Request $request): array
    {
        return $this->phone->login((string) $request->input('phone', ''), (string) $request->input('pin', ''), $request->ip);
    }

    public function login(Request $request): array
    {
        return $this->auth->login((string) $request->input('email', ''), (string) $request->input('password', ''), $request->ip);
    }

    public function refresh(Request $request): array
    {
        return $this->auth->refresh((string) $request->input('refresh_token', ''));
    }

    public function logout(Request $request): array
    {
        $this->auth->logout((string) $request->input('refresh_token', ''));
        return ['ok' => true];
    }

    public function me(Request $request): array
    {
        $user = $this->auth->find($request->user['id']) ?? throw new HttpException(401, 'Sign in to continue.');
        return $this->auth->publicUser($user);
    }
}

<?php

namespace App\Core;

use App\Config\Settings;
use App\Middleware\AuthMiddleware;
use App\Services\Bank\BankError;
use FastRoute\Dispatcher;
use FastRoute\RouteCollector;
use Throwable;

use function FastRoute\simpleDispatcher;

/** Turns a Request into a Response: CORS, routing, access control, and error mapping. */
final class Kernel
{
    private Dispatcher $dispatcher;

    public function __construct()
    {
        $this->dispatcher = simpleDispatcher(function (RouteCollector $routes) {
            (require dirname(__DIR__) . '/Routes/api.php')($routes);
        });
    }

    public function handle(Request $request): Response
    {
        if ($request->method === 'OPTIONS') {
            return (new Response(204, []))->withHeaders($this->cors($request));
        }
        try {
            $response = $this->dispatch($request);
        } catch (HttpException $e) {
            $response = Response::fail($request, $e->status, $e->getMessage(), $e->fields);
        } catch (BankError $e) {
            error_log("bank error on {$request->path}: {$e->getMessage()}");
            $response = Response::fail($request, 502, 'The banking sandbox rejected the request.',
                Settings::live() ? [] : ['bank_status' => $e->status, 'bank_body' => $e->body]);
        } catch (Throwable $e) {
            error_log((string) $e);
            $response = Response::fail($request, 500, Settings::live() ? 'Internal server error.' : $e->getMessage());
        }
        return $response->withHeaders($this->cors($request));
    }

    private function dispatch(Request $request): Response
    {
        $match = $this->dispatcher->dispatch($request->method, $request->path);
        if ($match[0] === Dispatcher::NOT_FOUND) {
            throw new HttpException(404, 'Not found.');
        }
        if ($match[0] === Dispatcher::METHOD_NOT_ALLOWED) {
            return Response::fail($request, 405, 'Method not allowed.')->withHeaders(['Allow' => implode(', ', $match[1])]);
        }

        [$class, $method, $roles] = $match[1];
        AuthMiddleware::enforce($request, $roles);

        $result = (new $class())->$method($request, ...array_values($match[2]));
        return $result instanceof Response ? $result : Response::json($request, 200, $result);
    }

    private function cors(Request $request): array
    {
        $headers = [
            'Vary' => 'Origin',
            'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
            'Access-Control-Max-Age' => '86400',
        ];
        $origin = $request->header('origin');
        if ($origin !== '' && in_array(rtrim($origin, '/'), Settings::allowedOrigins(), true)) {
            $headers['Access-Control-Allow-Origin'] = $origin;
        }
        return $headers;
    }
}

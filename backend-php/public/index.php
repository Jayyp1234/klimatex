<?php
/**
 * Single entry point. Laptop: php -S 0.0.0.0:8080 -t public public/index.php
 * Cluster: Apache in the Docker image, port 8080.
 */
require dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Env;
use App\Core\Kernel;
use App\Core\Request;

Env::load(dirname(__DIR__));

$path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// The website, exported from web/ by `npm run publish:site`. API paths never reach this block.
if (in_array($method, ['GET', 'HEAD'], true) && !preg_match('#^/(api|hooks|healthz)(/|$)#', $path)) {
    $safe = !str_contains($path, '..');
    if (PHP_SAPI === 'cli-server' && $safe && $path !== '/' && $path !== '/index.php' && is_file(__DIR__ . $path)) {
        return false; // laptop only: Apache serves real files itself
    }
    $page = $safe && is_file(__DIR__ . rtrim($path, '/') . '/index.html') ? __DIR__ . rtrim($path, '/') . '/index.html' : null;
    if ($page || is_file(__DIR__ . '/404.html')) {
        http_response_code($page ? 200 : 404);
        header('Content-Type: text/html; charset=utf-8');
        if ($method === 'GET') {
            readfile($page ?? __DIR__ . '/404.html');
        }
        exit;
    }
}

(new Kernel())->handle(Request::fromGlobals())->send();

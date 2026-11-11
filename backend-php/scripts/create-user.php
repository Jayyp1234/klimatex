<?php
/**
 * php scripts/create-user.php <email> <role> "<name>"
 * Creates a login and prints a one-time generated password. Roles: household installer auditor buyer lender admin
 */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));
[, $email, $role, $name] = array_pad($argv, 4, null);
if (!$email || !$name || !in_array($role, App\Models\UserRepository::ROLES, true)) {
    fwrite(STDERR, "usage: php scripts/create-user.php <email> <role> \"<name>\"\n");
    exit(1);
}
$password = rtrim(strtr(base64_encode(random_bytes(15)), '+/', '-_'), '=');
(new App\Models\UserRepository())->create($email, $name, password_hash($password, PASSWORD_DEFAULT), $role);
echo "created $email ($role)\npassword (shown once): $password\n";

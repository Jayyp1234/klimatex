# Build for the cluster's nodes:  docker build --platform linux/amd64 -t ghcr.io/<you>/klimatex-php:v1 .
# The website must be built first:  (cd ../web && npm ci && npm run publish:site)
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
COPY src ./src
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --ignore-platform-reqs

FROM php:8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev \
 && docker-php-ext-install pdo_pgsql pcntl \
 && rm -rf /var/lib/apt/lists/*
# Listen on 8080 (fixed port, as the platform guide requires) and serve public/
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
RUN sed -i 's/^Listen 80$/Listen 8080/' /etc/apache2/ports.conf
WORKDIR /var/www/html
COPY --from=vendor /app/vendor ./vendor
COPY src ./src
COPY public ./public
COPY data ./data
COPY scripts ./scripts
RUN chown -R www-data:www-data /var/www/html
EXPOSE 8080
# Migrations run once at start, never on a request.
CMD ["sh", "-c", "php scripts/migrate.php && exec apache2-foreground"]

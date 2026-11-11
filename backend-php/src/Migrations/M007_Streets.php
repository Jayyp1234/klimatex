<?php

namespace App\Migrations;

/**
 * Streets, for the street grade. homes_total comes from the installer's door-to-door survey and
 * counts every home on the street, including those still on generators, so a street's grade
 * reflects the whole street and not only our customers.
 */
final class M007_Streets
{
    public static function up(bool $sqlite): array
    {
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        $f = $sqlite ? 'REAL' : 'DOUBLE PRECISION';
        return [
            "CREATE TABLE streets (id $id, name VARCHAR(120) NOT NULL, area VARCHAR(80) NOT NULL, homes_total INTEGER NOT NULL,
                grid_hours_per_day $f NOT NULL, surveyed_on VARCHAR(10) NOT NULL, UNIQUE (name, area))",
            'ALTER TABLE sites ADD COLUMN street_id INTEGER REFERENCES streets (id)',
            'CREATE INDEX sites_street ON sites (street_id)',
        ];
    }
}

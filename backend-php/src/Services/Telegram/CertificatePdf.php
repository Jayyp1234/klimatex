<?php

namespace App\Services\Telegram;

use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;

/**
 * The Home Energy Certificate as a one-page A4 PDF, laid out to match the web certificate
 * (web/components/household/CertificateDocument.tsx) measure for measure.
 *
 * Written directly, with no PDF library or GD: the page works in CSS pixels (A4 = 794 x 1123 at
 * 96 dpi, y down) through one transform, so the web's sizes and spacings carry over unchanged.
 * Fonts are the PDF standard fonts (Helvetica for the sans, Times for the serif, Courier for
 * the mono); the logo is the web SVG as vector paths with its two gradients.
 */
final class CertificatePdf
{
    private const W = 794.0;
    private const H = 1123.0;
    private const FOREST = '#0b3f2a';
    private const GOLD = '#c9a227';
    private const GOLD_TEXT = '#9a7a12';
    private const INK = '#10201a';
    private const MUTED = '#6b7872';
    private const BODY = '#41504a';
    private const LINE = '#e1e7e0';

    /** EPC-style bands: the share of the home's power that still comes from a generator. */
    private const BANDS = [
        ['A', '0–2%', '#14683f'], ['B', '3–10%', '#2f8f00'], ['C', '11–25%', '#86b82b'], ['D', '26–40%', '#cdb51f'],
        ['E', '41–55%', '#e3a600'], ['F', '56–75%', '#e07a1f'], ['G', 'over 75%', '#c2410c'],
    ];

    private const FONTS = ['sans' => 'F1', 'sans-bold' => 'F2', 'serif-bold' => 'F3', 'serif-italic' => 'F4', 'mono-bold' => 'F5', 'dingbats' => 'F6'];

    private string $ops = '';

    /**
     * @param array $c       HomeService::certificate()
     * @param array $home    HomeService::detail()
     * @param ?string $asOf  the latest reading day (the web's dataAsOf); the certificate is issued then
     */
    public static function render(array $c, array $home, ?string $asOf): string
    {
        return (new self())->build($c, $home, $asOf);
    }

    private function build(array $c, array $home, ?string $asOf): string
    {
        $site = $home['site'];
        $validUntil = $asOf ? gmdate('Y-m-d', strtotime("$asOf +1 year")) : null;
        $code = sprintf('KX-%04d', $site['id']);
        $potential = preg_match('/^([A-G])\b/', trim($c['potential']), $m) ? $m[1] : 'A';
        $passed = count(array_filter($c['checks'], fn ($k) => $k['result'] === 'pass'));
        $nowColour = '#2f8f00';
        foreach (self::BANDS as [$g, , $colour]) {
            if ($g === $c['grade_now']) {
                $nowColour = $colour;
            }
        }

        $this->rect(0, 0, self::W, self::H, '#ffffff');

        // Frame and corners
        $this->roundRect(23.25, 23.25, self::W - 46.5, self::H - 46.5, 6, null, self::FOREST, 2.5);
        $this->roundRect(30.5, 30.5, self::W - 61, self::H - 61, 4, null, self::GOLD, 1);
        foreach ([[22, 22, 0], [self::W - 82, 22, 90], [self::W - 82, self::H - 82, 180], [22, self::H - 82, 270]] as [$x, $y, $rot]) {
            $this->corner($x, $y, $rot);
        }

        // Watermark leaf
        $this->ops .= sprintf("q /GS1 gs 1 0 0 1 %.2f %.2f cm 2.35 0 0 2.35 0 0 cm %s rg 100 10 m 40 40 20 110 60 170 c 120 170 180 120 180 30 c 150 20 120 15 100 10 c h f Q\n",
            self::W / 2 - 235, 0.52 * self::H - 235, self::rgb(self::FOREST));

        $left = 64.0;
        $right = self::W - 64;
        $width = $right - $left;

        // Header
        $this->logo($left, 54, 34);
        $this->text($right, $this->base(54, 10, 15), 'CERTIFICATE NUMBER', 'sans-bold', 10, self::MUTED, 2.2, 'right');
        $this->text($right, $this->base(69, 13, 19.5), $c['certificate'], 'mono-bold', 13, self::INK, 0, 'right');

        // Title
        $cx = self::W / 2;
        $this->text($cx, $this->base(112.5, 11, 16.5), 'METERED, NOT MODELLED', 'sans-bold', 11, self::GOLD_TEXT, 4.62, 'center');
        $this->text($cx, $this->base(137, 38, 38), 'Home Energy Certificate', 'serif-bold', 38, self::FOREST, -0.38, 'center');
        $this->rect($cx - 150, 190.5, 140.5, 1, self::GOLD);
        $this->rect($cx + 9.5, 190.5, 140.5, 1, self::GOLD);
        $this->ops .= sprintf("%s rg %.2f %.2f m %.2f %.2f l %.2f %.2f l %.2f %.2f l h f\n", self::rgb(self::GOLD), $cx, 185.3, $cx + 5.7, 191, $cx, 196.7, $cx - 5.7, 191);
        $y = 207.0;
        foreach ($this->wrap('This certifies that the home below was measured from its own solar inverter and graded on the share of its power that still comes from a generator.', 'serif-italic', 15, 560) as $line) {
            $this->text($cx, $this->base($y, 15, 24.375), $line, 'serif-italic', 15, self::BODY, 0, 'center');
            $y += 24.375;
        }

        // Home details and grade
        $boxTop = 275.8;
        $this->roundRect($left, $boxTop, $width, 161, 14, '#fbfcfa', self::LINE, 1);
        $details = [
            ['Household', $home['household']['name']],
            ['Home', "{$site['label']} · $code"],
            ['Location', "{$site['area']}, Lagos, Nigeria"],
            ['Solar system', self::trim($site['panel_kwp']) . " kWp · {$home['inverter']['serial']}"],
            ['Measured', self::longDate($home['daily'][0]['day'] ?? null) . ' to ' . self::longDate($asOf)],
            ['Generator', self::trim($home['generator']['kva']) . ' kVA, scrapped ' . self::longDate($home['generator']['scrapped_on'])],
        ];
        foreach ($details as $i => [$label, $value]) {
            $x = $left + 28 + ($i % 2) * 253;
            $top = $boxTop + 17 + intdiv($i, 2) * 47;
            $this->text($x, $this->base($top, 9.5, 14.25), strtoupper($label), 'sans-bold', 9.5, self::MUTED, 1.52);
            $this->text($x, $this->base($top + 16.25, 12.5, 18.75), $value, 'sans', 12.5, self::INK);
        }
        $gx = $right - 28 - 52;
        $gy = $boxTop + 18 + 52;
        $this->circle($gx, $gy, 52, $nowColour);
        $this->ops .= "q /GS4 gs\n";
        $this->circle($gx, $gy, 45, null, '#ffffff', 2);
        $this->ops .= "Q\n";
        $this->text($gx, $gy + 20, $c['grade_now'], 'serif-bold', 58, '#ffffff', 0, 'center');
        $this->text($gx, $this->base($gy + 60, 10, 15), 'GRADE NOW', 'sans-bold', 10, self::MUTED, 1.8, 'center');

        // Band chart
        $top = 456.8;
        $cols = [$left + 366 + 46, $left + 470 + 46, $left + 574 + 46];
        $this->text($left, $this->base($top, 10, 15), 'SHARE OF POWER FROM A GENERATOR', 'sans-bold', 10, self::MUTED, 1.6);
        foreach ([['BEFORE', 'SOLAR'], ['NOW'], ['POTENTIAL']] as $i => $lines) {
            foreach ($lines as $j => $line) {
                $this->text($cols[$i], $this->base($top + 15 * $j, 10, 15), $line, 'sans-bold', 10, self::MUTED, 1.4, 'center');
            }
        }
        foreach (self::BANDS as $i => [$grade, $range, $colour]) {
            $rowTop = $top + 34 + $i * 28;
            $barW = 354 * (44 + $i * 8) / 100;
            $this->rect($left, $rowTop, $barW, 24, $colour);
            $this->ops .= sprintf("%s rg %.2f %.2f m %.2f %.2f l %.2f %.2f l h f\n", self::rgb($colour), $left + $barW, $rowTop, $left + $barW + 11, $rowTop + 12, $left + $barW, $rowTop + 24);
            $this->text($left + 12, $rowTop + 16.6, $grade, 'sans-bold', 13, '#ffffff');
            $this->ops .= "q /GS2 gs\n";
            $this->text($left + $barW - 8, $rowTop + 15.8, $range, 'sans', 10.5, '#ffffff', 0, 'right');
            $this->ops .= "Q\n";
            $marks = [
                [$c['grade_before'] === $grade, self::MUTED, round($c['generator_share_before'] * 100) . '%'],
                [$c['grade_now'] === $grade, self::FOREST, round($c['generator_share_now'] * 100) . '%'],
                [$potential === $grade, '#14683f', 'battery'],
            ];
            foreach ($marks as $k => [$on, $tone, $share]) {
                if ($on) {
                    $this->pointer($cols[$k], $rowTop, $grade, $share, $tone);
                }
            }
        }

        // Figures
        $top = 702.8;
        $this->roundRect($left, $top, $width, 69.75, 12, null, self::LINE, 1);
        $cell = $width / 4;
        $figures = [
            ['CREDITED A YEAR', null],
            ['PETROL AVOIDED', number_format($c['petrol_litres_avoided_period']) . ' L'],
            ['TRUST SCORE', "{$c['trust_score']} / 100"],
            ['CHECKS PASSED', "$passed of " . count($c['checks'])],
        ];
        foreach ($figures as $i => [$label, $value]) {
            $x = $left + $cell * $i;
            if ($i) {
                $this->rect($x, $top, 1, 69.75, self::LINE);
            }
            $mid = $x + $cell / 2;
            $this->text($mid, $this->base($top + 13, 9.5, 14.25), $label, 'sans-bold', 9.5, self::MUTED, 1.43, 'center');
            $baseline = $this->base($top + 31.25, 17, 25.5);
            if ($value === null) {
                $this->co2($mid, $baseline, number_format($c['credited_tco2e_per_year'], 2), 17);
            } else {
                $this->text($mid, $baseline, $value, 'sans-bold', 17, self::FOREST, 0, 'center');
            }
        }

        // Next step, verification, QR
        $top = 788.5;
        $textW = $width - 24 - 96;
        $this->text($left, $this->base($top, 10, 15), 'RECOMMENDED NEXT STEP', 'sans-bold', 10, self::MUTED, 1.6);
        $y = $top + 19;
        foreach ($this->wrap("{$c['potential']}. Less generator time earns more credits, and the step can be financed with an Access solar loan.", 'sans', 13.5, $textW) as $line) {
            $this->text($left, $this->base($y, 13.5, 20.25), $line, 'sans', 13.5, self::INK);
            $y += 20.25;
        }
        $y += 12;
        $this->text($left, $this->base($y, 10, 15), 'VERIFICATION', 'sans-bold', 10, self::MUTED, 1.6);
        $this->checks($left, $y + 19, $c['checks'], $textW);
        $qx = $right - 96;
        $this->roundRect($qx + 0.5, $top + 0.5, 95, 95, 8, '#ffffff', self::LINE, 1);
        $this->qr($qx + 7, $top + 7, 82, sprintf("KlimateX Home Energy Certificate %s\n%s, %s, Lagos\nGrade %s (was %s)\nTrust score %d/100\nIssued %s",
            $c['certificate'], $site['label'], $site['area'], $c['grade_now'], $c['grade_before'], $c['trust_score'], $asOf ?? ''));
        $this->text($qx + 48, $this->base($top + 100, 9, 13.5), 'SCAN FOR DETAILS', 'sans-bold', 9, self::MUTED, 1.26, 'center');

        // Signatures and seal
        $sigTop = 972.5;
        $sideW = ($width - 96 - 48) / 2;
        $this->text($left, $this->base($sigTop, 22, 33), 'KlimateX Operations', 'serif-italic', 22, self::FOREST);
        $this->text($right, $this->base($sigTop, 22, 33), 'Independent auditor', 'serif-italic', 22, self::FOREST, 0, 'right');
        $this->ops .= "q /GS5 gs\n";
        $this->rect($left, $sigTop + 37, $sideW, 1, self::INK);
        $this->rect($right - $sideW, $sigTop + 37, $sideW, 1, self::INK);
        $this->ops .= "Q\n";
        $this->text($left, $this->base($sigTop + 44, 10.5, 15.75), 'Issued ' . self::longDate($asOf) . ' · valid to ' . self::longDate($validUntil), 'sans', 10.5, self::MUTED);
        $this->text($right, $this->base($sigTop + 44, 10.5, 15.75), 'Sample review and period sign-off', 'sans', 10.5, self::MUTED, 0, 'right');
        $this->seal(self::W / 2, 984.25, $c['grade_now'], $asOf ? substr($asOf, 0, 4) : '');

        $y = 1048.25;
        foreach ($this->wrap('KlimateX scale (proposed), not an official rating. Grades follow the metered share of power from a generator. Carbon credited under Gold Standard JUST: Fossil Fuel Generators v1.0 methodology factors; credits are issued and retired by the carbon registry.', 'sans', 9, $width) as $line) {
            $this->text($cx, $this->base($y, 9, 12.375), $line, 'sans', 9, self::MUTED, 0, 'center');
            $y += 12.375;
        }

        return $this->document();
    }

    // ----- pieces -----

    private function logo(float $x, float $y, float $height): void
    {
        $s = $height / LogoPaths::HEIGHT;
        $this->ops .= sprintf("q %.5f 0 0 %.5f %.2f %.2f cm\n", $s, $s, $x, $y);
        foreach (LogoPaths::PATHS as $i => $p) {
            if (isset($p['rgb'])) {
                $this->ops .= sprintf("%.4f %.4f %.4f rg %s f*\n", ...[...$p['rgb'], $p['d']]);
            } else {
                $this->ops .= "q {$p['d']} W* n /Sh$i sh Q\n";
            }
        }
        $this->ops .= "Q\n";
    }

    private function corner(float $x, float $y, int $rotation): void
    {
        [$cos, $sin] = [round(cos(deg2rad($rotation))), round(sin(deg2rad($rotation)))];
        // Rotate the 60 x 60 box about its own centre, then place it.
        $this->ops .= sprintf("q 1 0 0 1 %.2f %.2f cm %d %d %d %d 0 0 cm 1 0 0 1 -30 -30 cm\n", $x + 30, $y + 30, $cos, $sin, -$sin, $cos);
        $this->ops .= sprintf("%s RG 2 w 2 34 m 2 8 l 2 4.686 4.686 2 8 2 c 34 2 l S\n", self::rgb(self::GOLD));
        $this->ops .= sprintf("%s RG 1.6 w 12 26 m 12 14 l 12 12.895 12.895 12 14 12 c 26 12 l S\n", self::rgb(self::FOREST));
        $this->circle(8, 8, 3, self::GOLD);
        $this->ops .= "Q\n";
    }

    private function pointer(float $centre, float $top, string $grade, string $share, string $tone): void
    {
        $labelW = self::width($grade, 'sans-bold', 15);
        $shareW = self::width($share, 'sans', 12);
        $boxW = 10 + $labelW + 6 + $shareW + 10;
        $x = $centre - ($boxW + 10) / 2;
        $this->ops .= sprintf("%s rg %.2f %.2f m %.2f %.2f l %.2f %.2f l h f\n", self::rgb($tone), $x, $top + 12, $x + 10, $top, $x + 10, $top + 24);
        $this->roundRect($x + 10, $top, $boxW, 24, 6, $tone, null, 0, [0, 6, 6, 0]);
        $this->text($x + 20, $top + 17.3, $grade, 'sans-bold', 15, '#ffffff');
        $this->ops .= "q /GS3 gs\n";
        $this->text($x + 26 + $labelW, $top + 16.3, $share, 'sans', 12, '#ffffff');
        $this->ops .= "Q\n";
    }

    /** "1.84 tCO₂e", with the 2 as a subscript, centred on $mid. */
    private function co2(float $mid, float $baseline, string $tonnes, float $size): void
    {
        $head = "$tonnes tCO";
        $sub = $size * 0.7;
        $total = self::width($head, 'sans-bold', $size) + self::width('2', 'sans-bold', $sub) + self::width('e', 'sans-bold', $size);
        $x = $mid - $total / 2;
        $this->text($x, $baseline, $head, 'sans-bold', $size, self::FOREST);
        $x += self::width($head, 'sans-bold', $size);
        $this->text($x, $baseline + $size * 0.2, '2', 'sans-bold', $sub, self::FOREST);
        $x += self::width('2', 'sans-bold', $sub);
        $this->text($x, $baseline, 'e', 'sans-bold', $size, self::FOREST);
    }

    /** "Sunlight ✓ · Energy balance ✓ · ...", wrapped, with real tick and cross glyphs. */
    private function checks(float $x0, float $top, array $checks, float $maxW): void
    {
        $size = 11.5;
        $lineH = 18.6875;
        $items = [];
        foreach ($checks as $i => $check) {
            $label = ucfirst(str_replace('_', ' ', $check['name']));
            $items[] = [$label, $check['result'] === 'pass', $i < count($checks) - 1];
        }
        $space = self::width(' ', 'sans', $size);
        $x = $x0;
        $y = $top;
        foreach ($items as [$label, $pass, $more]) {
            $words = explode(' ', $label);
            foreach ($words as $w => $word) {
                $tail = $w === count($words) - 1;
                $wordW = self::width($word, 'sans', $size) + ($tail ? $space + 9 + ($more ? $space + self::width('·', 'sans', $size) : 0) : 0);
                if ($x > $x0 && $x + $wordW > $x0 + $maxW) {
                    $x = $x0;
                    $y += $lineH;
                }
                $baseline = $this->base($y, $size, $lineH);
                $this->text($x, $baseline, $word, 'sans', $size, self::BODY);
                $x += self::width($word, 'sans', $size) + $space;
                if ($tail) {
                    $this->text($x, $baseline - 0.5, $pass ? '3' : '7', 'dingbats', $size * 0.8, self::BODY);
                    $x += 9 + $space;
                    if ($more) {
                        $this->text($x, $baseline, '·', 'sans', $size, self::BODY);
                        $x += self::width('·', 'sans', $size) + $space;
                    }
                }
            }
        }
    }

    private function qr(float $x, float $y, float $size, string $text): void
    {
        $matrix = Encoder::encode($text, ErrorCorrectionLevel::M(), 'UTF-8')->getMatrix();
        $n = $matrix->getWidth();
        $m = $size / $n;
        $this->ops .= self::rgb(self::FOREST) . " rg\n";
        for ($row = 0; $row < $n; $row++) {
            for ($col = 0; $col < $n; $col++) {
                if ($matrix->get($col, $row) === 1) {
                    $this->ops .= sprintf("%.3f %.3f %.3f %.3f re ", $x + $col * $m, $y + $row * $m, $m + 0.02, $m + 0.02);
                }
            }
            $this->ops .= "\n";
        }
        $this->ops .= "f\n";
    }

    /** The web's 120 x 120 SVG seal at 96 px: rings, the circling legend, the grade and the year. */
    private function seal(float $cx, float $cy, string $grade, string $year): void
    {
        $s = 0.8;
        $this->circle($cx, $cy, 56 * $s, self::FOREST);
        $this->ops .= sprintf("[%.2f %.2f] 0 d\n", 2 * $s, 3 * $s);
        $this->circle($cx, $cy, 50 * $s, null, self::GOLD, 1.5 * $s);
        $this->ops .= "[] 0 d\n";
        $this->circle($cx, $cy, 38 * $s, null, self::GOLD, 1 * $s);

        $legend = 'METERED • VERIFIED • KLIMATEX • LAGOS • ';
        $r = 44 * $s;
        $size = 8 * $s;
        $natural = self::width($legend, 'sans-bold', $size);
        $chars = str_split(self::winAnsi($legend));
        $gap = (272 * $s - $natural) / count($chars); // the web sets textLength 272 on a 120 box
        $angle = M_PI; // starts at the left, runs clockwise over the top
        foreach ($chars as $ch) {
            $w = self::widthRaw($ch, 'sans-bold') * $size / 1000;
            $mid = $angle + ($w / 2) / $r;
            $px = $cx + $r * cos($mid);
            $py = $cy + $r * sin($mid);
            // Upright along the arc: the glyph's up points away from the centre.
            $t = $mid + M_PI / 2;
            [$c, $sn] = [cos($t), sin($t)];
            $this->ops .= sprintf("BT /F2 %.2f Tf %s rg %.4f %.4f %.4f %.4f %.3f %.3f Tm (%s) Tj ET\n", $size, self::rgb(self::GOLD),
                $c, $sn, $sn, -$c, $px - $c * $w / 2, $py - $sn * $w / 2, strtr($ch, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']));
            $angle += ($w + $gap) / $r;
        }
        $this->text($cx, $cy - 2 * $s, $grade, 'serif-bold', 22 * $s, '#ffffff', 0, 'center');
        $this->text($cx, $cy + 14 * $s, $year, 'sans-bold', 7.5 * $s, self::GOLD, 1.5 * $s, 'center');
    }

    // ----- drawing primitives (CSS pixels, y down) -----

    /** Baseline for a line box of height $lineH starting at $top. */
    private function base(float $top, float $size, float $lineH): float
    {
        return $top + $lineH / 2 + 0.355 * $size;
    }

    private function rect(float $x, float $y, float $w, float $h, string $fill): void
    {
        $this->ops .= sprintf("%s rg %.2f %.2f %.2f %.2f re f\n", self::rgb($fill), $x, $y, $w, $h);
    }

    /** @param float[] $radii top-left, top-right, bottom-right, bottom-left */
    private function roundRect(float $x, float $y, float $w, float $h, float $r, ?string $fill, ?string $stroke, float $width, ?array $radii = null): void
    {
        [$tl, $tr, $br, $bl] = $radii ?? [$r, $r, $r, $r];
        $k = 0.4477; // 1 - 0.5523
        $p = sprintf('%.2f %.2f m %.2f %.2f l ', $x + $tl, $y, $x + $w - $tr, $y)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c ', $x + $w - $tr * $k, $y, $x + $w, $y + $tr * $k, $x + $w, $y + $tr)
            . sprintf('%.2f %.2f l ', $x + $w, $y + $h - $br)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c ', $x + $w, $y + $h - $br * $k, $x + $w - $br * $k, $y + $h, $x + $w - $br, $y + $h)
            . sprintf('%.2f %.2f l ', $x + $bl, $y + $h)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c ', $x + $bl * $k, $y + $h, $x, $y + $h - $bl * $k, $x, $y + $h - $bl)
            . sprintf('%.2f %.2f l ', $x, $y + $tl)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c h', $x, $y + $tl * $k, $x + $tl * $k, $y, $x + $tl, $y);
        if ($fill) {
            $this->ops .= self::rgb($fill) . " rg $p f\n";
        }
        if ($stroke) {
            $this->ops .= sprintf("%s RG %.2f w %s S\n", self::rgb($stroke), $width, $p);
        }
    }

    private function circle(float $cx, float $cy, float $r, ?string $fill, ?string $stroke = null, float $width = 1): void
    {
        $k = 0.5523 * $r;
        $p = sprintf('%.2f %.2f m ', $cx + $r, $cy)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c ', $cx + $r, $cy + $k, $cx + $k, $cy + $r, $cx, $cy + $r)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c ', $cx - $k, $cy + $r, $cx - $r, $cy + $k, $cx - $r, $cy)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c ', $cx - $r, $cy - $k, $cx - $k, $cy - $r, $cx, $cy - $r)
            . sprintf('%.2f %.2f %.2f %.2f %.2f %.2f c h', $cx + $k, $cy - $r, $cx + $r, $cy - $k, $cx + $r, $cy);
        if ($fill) {
            $this->ops .= self::rgb($fill) . " rg $p f\n";
        }
        if ($stroke) {
            $this->ops .= sprintf("%s RG %.2f w %s S\n", self::rgb($stroke), $width, $p);
        }
    }

    private function text(float $x, float $baseline, string $s, string $font, float $size, string $colour, float $tracking = 0, string $align = 'left'): void
    {
        $w = self::width($s, $font, $size) + $tracking * strlen(self::winAnsi($s));
        $x = match ($align) {
            'center' => $x - ($w - $tracking) / 2,
            'right' => $x - $w + $tracking,
            default => $x,
        };
        $this->ops .= sprintf("BT /%s %.2f Tf %.3f Tc %s rg 1 0 0 -1 %.2f %.2f Tm (%s) Tj ET\n",
            self::FONTS[$font], $size, $tracking, self::rgb($colour), $x, $baseline, self::escape($s));
    }

    /** @return string[] */
    private function wrap(string $text, string $font, float $size, float $maxW): array
    {
        $lines = [];
        $line = '';
        foreach (explode(' ', $text) as $word) {
            $try = $line === '' ? $word : "$line $word";
            if ($line !== '' && self::width($try, $font, $size) > $maxW) {
                $lines[] = $line;
                $line = $word;
            } else {
                $line = $try;
            }
        }
        return $line === '' ? $lines : [...$lines, $line];
    }

    // ----- fonts -----

    /** Advance widths for ASCII 32-126 in 1/1000 em, from the standard font metrics. */
    private const METRICS = [
        'sans' => [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
        'sans-bold' => [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584],
        'serif-bold' => [250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500, 930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500, 333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520],
        'serif-italic' => [250, 333, 420, 500, 500, 833, 778, 214, 333, 333, 500, 675, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 675, 675, 675, 500, 920, 611, 611, 667, 722, 611, 611, 722, 722, 333, 444, 667, 556, 833, 667, 722, 611, 722, 611, 500, 556, 722, 611, 833, 611, 556, 556, 389, 278, 389, 422, 500, 333, 500, 500, 444, 500, 444, 278, 500, 500, 278, 278, 444, 278, 722, 500, 500, 500, 500, 389, 389, 278, 500, 444, 667, 444, 444, 389, 400, 275, 400, 541],
    ];

    private static function widthRaw(string $ch, string $font): int
    {
        if ($font === 'mono-bold') {
            return 600;
        }
        if ($font === 'dingbats') {
            return $ch === '3' ? 755 : 571;
        }
        $o = ord($ch);
        if ($o >= 32 && $o <= 126) {
            return self::METRICS[$font][$o - 32];
        }
        return match ($o) { 0xB7 => 278, 0x95 => 350, 0x96 => 556, default => 556 };
    }

    public static function width(string $s, string $font, float $size): float
    {
        $sum = 0;
        foreach (str_split(self::winAnsi($s)) as $ch) {
            $sum += self::widthRaw($ch, $font);
        }
        return $sum * $size / 1000;
    }

    private static function winAnsi(string $s): string
    {
        if ($s === '') {
            return '';
        }
        $out = @iconv('UTF-8', 'Windows-1252//TRANSLIT', $s);
        return $out === false ? preg_replace('/[^\x20-\x7E]/', '?', $s) : $out;
    }

    private static function escape(string $s): string
    {
        return strtr(self::winAnsi($s), ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
    }

    private static function rgb(string $hex): string
    {
        [$r, $g, $b] = sscanf($hex, '#%02x%02x%02x');
        return sprintf('%.4f %.4f %.4f', $r / 255, $g / 255, $b / 255);
    }

    private static function trim(float|int|string $n): string
    {
        return rtrim(rtrim(number_format((float) $n, 2, '.', ''), '0'), '.');
    }

    private static function longDate(?string $iso): string
    {
        return $iso ? gmdate('j M Y', strtotime(substr($iso, 0, 10) . 'T00:00:00Z')) : 'Not recorded';
    }

    // ----- file -----

    private function document(): string
    {
        $fonts = ['Helvetica', 'Helvetica-Bold', 'Times-Bold', 'Times-Italic', 'Courier-Bold'];
        $objects = [
            1 => '<< /Type /Catalog /Pages 2 0 R >>',
            2 => '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        ];
        $next = 4;
        $fontRefs = [];
        foreach ($fonts as $i => $name) {
            $objects[$next] = "<< /Type /Font /Subtype /Type1 /BaseFont /$name /Encoding /WinAnsiEncoding >>";
            $fontRefs[] = '/F' . ($i + 1) . " $next 0 R";
            $next++;
        }
        $objects[$next] = '<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats >>';
        $fontRefs[] = "/F6 $next 0 R";
        $next++;
        $shadings = [];
        foreach (LogoPaths::PATHS as $i => $p) {
            if (isset($p['grad'])) {
                $objects[$next] = sprintf('<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [%s] /Extend [true true] /Function << /FunctionType 2 /Domain [0 1] /C0 [%s] /C1 [%s] /N 1 >> >>',
                    implode(' ', $p['grad']), implode(' ', $p['c0']), implode(' ', $p['c1']));
                $shadings[] = "/Sh$i $next 0 R";
                $next++;
            }
        }
        $content = sprintf("0.75 0 0 -0.75 0 %.2f cm\n", 842) . $this->ops;
        $objects[$next] = '<< /Length ' . strlen($content) . " >>\nstream\n$content\nendstream";
        $contentRef = $next;
        $objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 842] /Contents ' . $contentRef . ' 0 R /Resources << /Font << ' . implode(' ', $fontRefs) . ' >>'
            . ' /Shading << ' . implode(' ', $shadings) . ' >>'
            . ' /ExtGState << /GS1 << /ca 0.035 >> /GS2 << /ca 0.9 >> /GS3 << /ca 0.85 >> /GS4 << /CA 0.7 >> /GS5 << /ca 0.6 >> >> >> >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objects as $n => $body) {
            $offsets[$n] = strlen($pdf);
            $pdf .= "$n 0 obj\n$body\nendobj\n";
        }
        $xref = strlen($pdf);
        $count = max(array_keys($objects)) + 1;
        $pdf .= "xref\n0 $count\n0000000000 65535 f \n";
        for ($n = 1; $n < $count; $n++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$n]);
        }
        return $pdf . "trailer << /Size $count /Root 1 0 R /Info << /Title (KlimateX Home Energy Certificate) /Producer (KlimateX) >> >>\nstartxref\n$xref\n%%EOF\n";
    }
}

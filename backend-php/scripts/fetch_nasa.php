<?php
/**
 * Download real daily sunlight for Surulere from NASA POWER and save it where the simulator
 * looks for it. Run on any machine with internet (pods may not reach the internet):
 *     php scripts/fetch_nasa.php
 * then rebuild the image so data/sunlight_surulere_2026.json ships inside it.
 */
$lat = 6.4980; $lon = 3.3550;
$url = "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN"
    . "&community=RE&latitude=$lat&longitude=$lon&start=20260101&end=20260630&format=JSON";
$json = json_decode(file_get_contents($url), true);
$data = $json['properties']['parameter']['ALLSKY_SFC_SW_DWN'] ?? [];
$out = [];
foreach ($data as $k => $v) {
    if ($v !== null && $v >= 0) $out[substr($k, 0, 4) . '-' . substr($k, 4, 2) . '-' . substr($k, 6, 2)] = $v;
}
$path = __DIR__ . '/../data/sunlight_surulere_2026.json';
file_put_contents($path, json_encode($out, JSON_PRETTY_PRINT));
echo 'saved ' . count($out) . " days to $path\n";

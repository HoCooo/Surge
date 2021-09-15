if ($network.wifi.ssid === 'LEDE' || $network.wifi.ssid === 'LEDE') {
$done({servers:$network.dns})
} else {
$done({})
}

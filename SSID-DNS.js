if ($network.wifi.ssid === 'LEDE' || $network.wifi.ssid === 'InssCore') {
$done({servers:$network.dns})
} else {
$done({})
}

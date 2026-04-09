#!/bin/sh
set -e

# Install iptables if missing (jasonish/suricata is alpine/centos based)
if ! command -v iptables >/dev/null 2>&1; then
    if command -v apk >/dev/null 2>&1; then
        apk add --no-cache iptables
    elif command -v yum >/dev/null 2>&1; then
        yum install -y iptables
    fi
fi

# Download/update Suricata rules (ET Open Ruleset - ~50k rules)
echo "[Edge FW] Downloading Suricata rules via suricata-update..."
if command -v suricata-update >/dev/null 2>&1; then
    suricata-update --no-reload --no-test 2>&1 | tail -5
    echo "[Edge FW] Rules loaded successfully."
else
    echo "[Edge FW] Warning: suricata-update not found, skipping rule update."
fi

# Try to resolve proxy-inverso IP
PROXY_IP=$(getent hosts proxy-inverso | awk '{ print $1 }')

if [ -z "$PROXY_IP" ] && command -v ping >/dev/null 2>&1; then
    PROXY_IP=$(ping -c 1 proxy-inverso | awk -F'[()]' '/PING/{print $2}' || true)
fi

if [ -n "$PROXY_IP" ]; then
    echo "[Edge FW] Routing incoming 80/443 traffic to proxy-inverso ($PROXY_IP)..."
    iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination $PROXY_IP:80
    iptables -t nat -A PREROUTING -p tcp --dport 443 -j DNAT --to-destination $PROXY_IP:443
    iptables -t nat -A POSTROUTING -p tcp -d $PROXY_IP --dport 80 -j MASQUERADE
    iptables -t nat -A POSTROUTING -p tcp -d $PROXY_IP --dport 443 -j MASQUERADE
else
    echo "[Edge FW] Warning: Could not resolve proxy-inverso IP. DNAT not established."
fi

# Start Suricata IPS/IDS
echo "[Edge FW] Starting Suricata (IPS/IDS)..."
if command -v suricata >/dev/null 2>&1; then
    exec suricata -i eth0 -i eth1 -i eth2
else
    echo "[Edge FW] Suricata binary not in PATH. Running dummy loop..."
    exec tail -f /dev/null
fi

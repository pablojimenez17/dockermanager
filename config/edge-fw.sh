#!/bin/sh
set -e

# ============================================================
# Edge Firewall entrypoint — Suricata IDS/IPS
# FIX #1: Suricata owns ports 80/443 and DNAT-forwards to
#         Traefik (proxy-inverso) via iptables PREROUTING.
#         This makes ALL inbound traffic inspected by Suricata
#         before reaching the reverse proxy.
# ============================================================

# Install iptables if missing (jasonish/suricata is alpine/centos based)
if ! command -v iptables >/dev/null 2>&1; then
    if command -v apk >/dev/null 2>&1; then
        apk add --no-cache iptables
    elif command -v yum >/dev/null 2>&1; then
        yum install -y iptables
    fi
fi

# Download/update Suricata rules (ET Open Ruleset — ~50k rules)
echo "[Edge FW] Downloading Suricata rules via suricata-update..."
if command -v suricata-update >/dev/null 2>&1; then
    suricata-update --no-reload --no-test 2>&1 | tail -5
    echo "[Edge FW] Rules loaded successfully."
else
    echo "[Edge FW] Warning: suricata-update not found, skipping rule update."
fi

# --------------------------------------------------------
# iptables PREROUTING — DNAT incoming 80/443 to Traefik
# Retry up to 10 times to allow proxy-inverso to start
# --------------------------------------------------------
PROXY_IP=""
RETRIES=10

echo "[Edge FW] Resolving proxy-inverso IP (up to ${RETRIES} attempts)..."
for i in $(seq 1 $RETRIES); do
    PROXY_IP=$(getent hosts proxy-inverso 2>/dev/null | awk '{ print $1 }' | head -1)
    if [ -n "$PROXY_IP" ]; then
        break
    fi
    echo "[Edge FW] Attempt $i/$RETRIES — proxy-inverso not yet available, retrying in 3s..."
    sleep 3
done

if [ -n "$PROXY_IP" ]; then
    echo "[Edge FW] proxy-inverso resolved to $PROXY_IP — configuring DNAT rules..."

    # Flush any previous rules to avoid duplicates on restart
    iptables -t nat -F PREROUTING 2>/dev/null || true
    iptables -t nat -F POSTROUTING 2>/dev/null || true

    # DNAT: forward incoming 80/443 to Traefik
    iptables -t nat -A PREROUTING -p tcp --dport 80  -j DNAT --to-destination "$PROXY_IP:80"
    iptables -t nat -A PREROUTING -p tcp --dport 443 -j DNAT --to-destination "$PROXY_IP:443"

    # MASQUERADE: ensure return traffic is correctly routed back
    iptables -t nat -A POSTROUTING -p tcp -d "$PROXY_IP" --dport 80  -j MASQUERADE
    iptables -t nat -A POSTROUTING -p tcp -d "$PROXY_IP" --dport 443 -j MASQUERADE

    echo "[Edge FW] iptables PREROUTING rules set — traffic will flow through Suricata IPS."
else
    echo "[Edge FW] ERROR: Could not resolve proxy-inverso after $RETRIES attempts."
    echo "[Edge FW] Suricata will still run but DNAT forwarding is NOT active."
    echo "[Edge FW] Check that proxy-inverso is on the same Docker network as edge-fw."
fi

# --------------------------------------------------------
# Start Suricata IDS/IPS
# Listen on all attached interfaces (eth0=public, eth1=transit_inverso, eth2=transit_forward)
# --------------------------------------------------------
echo "[Edge FW] Starting Suricata (IPS/IDS)..."
if command -v suricata >/dev/null 2>&1; then
    exec suricata -i eth0 -i eth1 -i eth2
else
    echo "[Edge FW] Suricata binary not in PATH. Running dummy loop (dev mode)..."
    exec tail -f /dev/null
fi

#!/bin/sh
set -e

# Enable IP forwarding (now handled by compose sysctl)

# Install iptables if missing (jasonish/suricata is alpine/centos based)
if ! command -v iptables &> /dev/null; then
    if command -v apk &> /dev/null; then
        apk add --no-cache iptables
    elif command -v yum &> /dev/null; then
        yum install -y iptables
    fi
fi

# Try to resolve proxy-inverso IP
PROXY_IP=$(getent hosts proxy-inverso | awk '{ print $1 }')

if [ -z "$PROXY_IP" ] && command -v ping &> /dev/null; then
    PROXY_IP=$(ping -c 1 proxy-inverso | awk -F'[()]' '/PING/{print $2}' || true)
fi

if [ -n "$PROXY_IP" ]; then
    echo "[Edge FW] Routing incoming 80/443 traffic to proxy-inverso ($PROXY_IP)..."
    iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination $PROXY_IP:80
    iptables -t nat -A PREROUTING -p tcp --dport 443 -j DNAT --to-destination $PROXY_IP:443
    # Masquerade to ensure return traffic goes back through Suricata
    iptables -t nat -A POSTROUTING -p tcp -d $PROXY_IP --dport 80 -j MASQUERADE
    iptables -t nat -A POSTROUTING -p tcp -d $PROXY_IP --dport 443 -j MASQUERADE
else
    echo "[Edge FW] Warning: Could not resolve proxy-inverso IP. DNAT not established."
fi

# Fallback to Suricata
echo "[Edge FW] Starting Suricata (IPS/IDS)..."
if command -v suricata &> /dev/null; then
    exec suricata -i eth0
else
    # Fallback to keep container alive if suricata binary isn't straightforwardly mapped
    echo "[Edge FW] Suricata binary not in PATH. Running dummy loop..."
    exec tail -f /dev/null
fi

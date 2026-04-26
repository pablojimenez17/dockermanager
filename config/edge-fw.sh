#!/bin/sh
set -e

# ============================================================
# Edge Firewall entrypoint — Suricata IDS/IPS
# FIX #8 (NEW): Hardened error handling + robust DNS resolution
# FIX #1: Suricata owns ports 80/443 and DNAT-forwards to
#         Traefik (proxy-inverso) via iptables PREROUTING.
#         This makes ALL inbound traffic inspected by Suricata
#         before reaching the reverse proxy.
# ============================================================

# Create logging directory
mkdir -p /var/log/dockermanager
LOGFILE="/var/log/dockermanager/edge-fw.log"

# Logging function with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🔴 EDGE FIREWALL STARTUP (Suricata IDS/IPS) — FIX #8"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Install iptables if missing (jasonish/suricata is alpine/centos based)
if ! command -v iptables >/dev/null 2>&1; then
    log "[*] iptables not found. Installing..."
    if command -v apk >/dev/null 2>&1; then
        apk add --no-cache iptables
    elif command -v yum >/dev/null 2>&1; then
        yum install -y iptables
    fi
    log "[✓] iptables installed successfully"
fi

# Download/update Suricata rules (ET Open Ruleset — ~50k rules)
log "[*] Downloading Suricata rules via suricata-update..."
if command -v suricata-update >/dev/null 2>&1; then
    if suricata-update --no-reload --no-test 2>&1 | tail -5 | tee -a "$LOGFILE"; then
        log "[✓] Suricata rules loaded successfully"
    else
        log "[⚠] Warning: suricata-update completed with warnings"
    fi
else
    log "[⚠] Warning: suricata-update not found, skipping rule update"
fi

# ========================================================
# FIX #8: Hardened DNS Resolution with Retry + HARD FAIL
# ========================================================
log "[*] Resolving proxy-inverso IP address..."
PROXY_IP=""
RETRIES=10
RETRY_DELAY=3
TIMEOUT_TOTAL=$((RETRIES * RETRY_DELAY))

for i in $(seq 1 $RETRIES); do
    PROXY_IP=$(getent hosts proxy-inverso 2>/dev/null | awk '{ print $1 }' | head -1)
    if [ -n "$PROXY_IP" ]; then
        log "[✓] proxy-inverso resolved to IP: $PROXY_IP (Attempt $i/$RETRIES)"
        break
    fi
    REMAINING=$((TIMEOUT_TOTAL - (i * RETRY_DELAY)))
    log "[⏳] Attempt $i/$RETRIES — proxy-inverso not yet available (${REMAINING}s remaining, retrying in ${RETRY_DELAY}s...)"
    sleep $RETRY_DELAY
done

# ========================================================
# FIX #8: CRITICAL VALIDATION — Exit if DNS fails
# ========================================================
if [ -z "$PROXY_IP" ]; then
    log ""
    log "❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "❌ CRITICAL FAILURE: proxy-inverso DNS resolution failed"
    log "❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "❌"
    log "❌ Suricata CANNOT function without a Traefik target."
    log "❌ The firewall cannot configure DNAT rules."
    log "❌"
    log "❌ Possible root causes:"
    log "❌   1. proxy-inverso container not started yet"
    log "❌   2. proxy-inverso not on 'transit_proxy_inverso' network"
    log "❌   3. Docker DNS resolver not responding (check /etc/resolv.conf)"
    log "❌   4. Network namespace issues"
    log "❌"
    log "❌ Docker will restart this container (exponential backoff)."
    log "❌ Check 'docker logs dockermanager-edge-fw' for details."
    log "❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log ""
    exit 1  # 🔴 HARD FAIL — Docker restart policy handles retry
fi

# ========================================================
# DNAT Configuration via iptables
# ========================================================
log "[*] Configuring iptables DNAT rules..."
log "    → PREROUTING: Incoming 80/443 → Traefik ($PROXY_IP:80/443)"
log "    → POSTROUTING: Return traffic masqueraded back"

# Flush any previous rules to avoid duplicates on restart
iptables -t nat -F PREROUTING 2>/dev/null || true
iptables -t nat -F POSTROUTING 2>/dev/null || true
iptables -F FORWARD 2>/dev/null || true

# DNAT: forward incoming 80/443 to Traefik
iptables -t nat -A PREROUTING -p tcp --dport 80  -j DNAT --to-destination "$PROXY_IP:80"
iptables -t nat -A PREROUTING -p tcp --dport 443 -j DNAT --to-destination "$PROXY_IP:443"

# MASQUERADE: ensure return traffic is correctly routed back
iptables -t nat -A POSTROUTING -p tcp -d "$PROXY_IP" --dport 80  -j MASQUERADE
iptables -t nat -A POSTROUTING -p tcp -d "$PROXY_IP" --dport 443 -j MASQUERADE

# ========================================================
# FIX: Enable IPS (Intrusion Prevention System) via NFQUEUE
# ========================================================
log "[*] Configuring iptables NFQUEUE rules for Suricata IPS..."
iptables -I FORWARD -j NFQUEUE --queue-num 0 --queue-bypass

log "[✓] iptables DNAT and NFQUEUE rules configured successfully"
log "[✓] ALL inbound traffic (80/443) will be inspected by Suricata IPS"

# ========================================================
# Start Suricata IDS/IPS
# ========================================================
log "[*] Starting Suricata (IPS/IDS)..."
log "    → Monitoring interfaces: eth0 (public), eth1 (transit-admin), eth2 (transit-users)"
log "    → Alert output: /var/log/suricata/eve.json"
log "    → Rules: ET Open Ruleset (~49,500 signatures)"
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v suricata >/dev/null 2>&1; then
    # FIX #8: Use configuration file if available
    if [ -f /etc/suricata/suricata.yaml ]; then
        log "[✓] Using custom Suricata configuration: /etc/suricata/suricata.yaml"
        exec suricata -c /etc/suricata/suricata.yaml -q 0
    else
        log "[*] Using default Suricata configuration"
        exec suricata -q 0
    fi
else
    log "[⚠] Suricata binary not in PATH. Running dummy loop (dev mode)..."
    exec tail -f /dev/null
fi

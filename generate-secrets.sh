#!/bin/bash
# ============================================================
# generate-secrets.sh — Helper to generate BasicAuth hashes
# for Prometheus and EveBox Traefik middlewares.
#
# Usage:
#   chmod +x generate-secrets.sh
#   ./generate-secrets.sh
#
# Requirements: apache2-utils (htpasswd) or httpd-tools
#   Ubuntu/Debian: sudo apt install apache2-utils
#   CentOS/RHEL:   sudo yum install httpd-tools
# ============================================================

set -e

command -v htpasswd >/dev/null 2>&1 || {
    echo "ERROR: htpasswd not found."
    echo "Install with: sudo apt install apache2-utils  (Debian/Ubuntu)"
    echo "           or: sudo yum install httpd-tools    (CentOS/RHEL)"
    exit 1
}

echo ""
echo "=== DockerManager — Secrets Generator ==="
echo ""

# --- Prometheus BasicAuth ---
read -rp "Prometheus username [admin]: " PROM_USER
PROM_USER=${PROM_USER:-admin}
read -rsp "Prometheus password: " PROM_PASS
echo ""

PROM_HASH=$(htpasswd -nb "$PROM_USER" "$PROM_PASS" | sed 's/\$/\$\$/g')
echo ""
echo "[Prometheus] PROMETHEUS_BASICAUTH_USERS=$PROM_HASH"

# --- EveBox BasicAuth ---
echo ""
read -rp "EveBox username [admin]: " EVE_USER
EVE_USER=${EVE_USER:-admin}
read -rsp "EveBox password: " EVE_PASS
echo ""

EVE_HASH=$(htpasswd -nb "$EVE_USER" "$EVE_PASS" | sed 's/\$/\$\$/g')
echo ""
echo "[EveBox]    EVEBOX_BASICAUTH_USERS=$EVE_HASH"

# --- MinIO credentials ---
echo ""
read -rp "MinIO root user [admin]: " MINIO_USER
MINIO_USER=${MINIO_USER:-admin}
read -rsp "MinIO root password: " MINIO_PASS
echo ""

# --- Grafana credentials ---
echo ""
read -rp "Grafana admin user [admin]: " GF_USER
GF_USER=${GF_USER:-admin}
read -rsp "Grafana admin password: " GF_PASS
echo ""

# --- NAS/Backup credentials ---
echo ""
read -rp "NAS/Backup username [admin]: " NAS_USER
NAS_USER=${NAS_USER:-admin}
read -rsp "NAS/Backup password: " NAS_PASS
echo ""

# --- Write .env ---
ENV_FILE=".env"
cat > "$ENV_FILE" <<EOF
# DockerManager — Generated secrets ($(date -u +"%Y-%m-%dT%H:%M:%SZ"))
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

MINIO_ROOT_USER=$MINIO_USER
MINIO_ROOT_PASSWORD=$MINIO_PASS

NAS_USERNAME=$NAS_USER
NAS_PASSWORD=$NAS_PASS

GF_SECURITY_ADMIN_USER=$GF_USER
GF_SECURITY_ADMIN_PASSWORD=$GF_PASS

PROMETHEUS_BASICAUTH_USERS=$PROM_HASH
EVEBOX_BASICAUTH_USERS=$EVE_HASH
EOF

echo ""
echo "✅ .env written successfully."
echo ""
echo "Next steps:"
echo "  1. Review .env to make sure values are correct"
echo "  2. docker compose down && docker compose up -d"
echo ""

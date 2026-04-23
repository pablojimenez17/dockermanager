#!/bin/bash
# ============================================================
# generate-secrets.sh — Genera todos los secrets de DockerManager
#
# Usage:
#   chmod +x generate-secrets.sh
#   ./generate-secrets.sh
#
# Requirements: apache2-utils (htpasswd) o httpd-tools
#   Ubuntu/Debian: sudo apt install apache2-utils
#   CentOS/RHEL:   sudo yum install httpd-tools
# ============================================================

set -e

command -v htpasswd >/dev/null 2>&1 || {
    echo "ERROR: htpasswd no encontrado."
    echo "Instala con: sudo apt install apache2-utils  (Debian/Ubuntu)"
    echo "          o: sudo yum install httpd-tools     (CentOS/RHEL)"
    exit 1
}

echo ""
echo "=== DockerManager — Secrets Generator ==="
echo ""

# --- MinIO (= bóveda de backups S3 interna) ---
# El backend se conecta a MinIO vía HAProxy con protocolo S3.
# NAS_USERNAME/NAS_PASSWORD son las MISMAS credenciales que MINIO_ROOT_USER/PASSWORD.
echo "--- MinIO (bóveda de backups interna) ---"
echo "  Nota: estas credenciales se reutilizan como NAS_USERNAME/NAS_PASSWORD"
echo "  porque el backend accede a MinIO vía S3 a través del HAProxy."
echo ""
read -rp "MinIO root user [admin]: " MINIO_USER
MINIO_USER=${MINIO_USER:-admin}
read -rsp "MinIO root password: " MINIO_PASS
echo ""

# --- Grafana ---
echo ""
echo "--- Grafana ---"
read -rp "Grafana admin user [admin]: " GF_USER
GF_USER=${GF_USER:-admin}
read -rsp "Grafana admin password: " GF_PASS
echo ""

# --- Prometheus BasicAuth (hash htpasswd) ---
echo ""
echo "--- Prometheus BasicAuth ---"
read -rp "Prometheus username [admin]: " PROM_USER
PROM_USER=${PROM_USER:-admin}
read -rsp "Prometheus password: " PROM_PASS
echo ""

PROM_HASH=$(htpasswd -nb "$PROM_USER" "$PROM_PASS" | sed 's/\$/\$\$/g')
echo "  → Hash: $PROM_HASH"

# --- EveBox BasicAuth (hash htpasswd) ---
echo ""
echo "--- EveBox BasicAuth ---"
read -rp "EveBox username [admin]: " EVE_USER
EVE_USER=${EVE_USER:-admin}
read -rsp "EveBox password: " EVE_PASS
echo ""

EVE_HASH=$(htpasswd -nb "$EVE_USER" "$EVE_PASS" | sed 's/\$/\$\$/g')
echo "  → Hash: $EVE_HASH"

# --- Escribir .env ---
ENV_FILE=".env"
cat > "$ENV_FILE" <<EOF
# DockerManager — Secrets generados el $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# NO SUBIR A GIT

# --- MinIO (Bóveda de Backups interna) ---
# MinIO es el almacenamiento S3 interno donde se guardan los backups.
# NAS_USERNAME/NAS_PASSWORD son las credenciales S3 con las que el backend
# se conecta a MinIO vía HAProxy — mismo valor que MINIO_ROOT_USER/PASSWORD.
MINIO_ROOT_USER=$MINIO_USER
MINIO_ROOT_PASSWORD=$MINIO_PASS

# Credenciales S3 del backend (mismo sistema, mismo valor que los de arriba)
NAS_USERNAME=$MINIO_USER
NAS_PASSWORD=$MINIO_PASS

# --- Grafana ---
GF_SECURITY_ADMIN_USER=$GF_USER
GF_SECURITY_ADMIN_PASSWORD=$GF_PASS

# --- BasicAuth Traefik middlewares (htpasswd hash) ---
PROMETHEUS_BASICAUTH_USERS=$PROM_HASH
EVEBOX_BASICAUTH_USERS=$EVE_HASH
EOF

echo ""
echo "✅ .env generado correctamente."
echo ""
echo "Próximos pasos:"
echo "  1. Revisa .env para confirmar que los valores son correctos"
echo "  2. docker compose -f docker-compose.yml down && docker compose -f docker-compose.yml up -d --build"
echo ""

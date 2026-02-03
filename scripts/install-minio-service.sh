#!/usr/bin/env bash
# Instala MinIO como serviço systemd para iniciar no boot e ficar rodando.
# Uso: sudo ./scripts/install-minio-service.sh

set -e
if [ "$EUID" -ne 0 ] 2>/dev/null; then
  echo "Execute com: sudo $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MINIO_BIN="${MINIO_BIN:-/usr/local/bin/minio}"
SERVICE_USER="${SUDO_USER:-$(whoami)}"
SERVICE_GROUP="$(id -gn "$SERVICE_USER")"

echo "=== Instalando MinIO como serviço ==="
echo "Projeto: $PROJECT_ROOT"
echo "Binário MinIO: $MINIO_BIN"
echo "Usuário do serviço: $SERVICE_USER"
echo ""

# Verificar/criar binário MinIO
if [ ! -x "$MINIO_BIN" ]; then
  echo "MinIO não encontrado em $MINIO_BIN. Baixando..."
  curl -sSLo "$MINIO_BIN" "https://dl.min.io/server/minio/release/linux-amd64/minio"
  chmod +x "$MINIO_BIN"
  echo "MinIO instalado em $MINIO_BIN"
fi

# Criar diretório de dados
mkdir -p "$PROJECT_ROOT/minio-data"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$PROJECT_ROOT/minio-data" 2>/dev/null || true

# Criar unit systemd
UNIT_FILE="/etc/systemd/system/minio-descomplicar.service"
cat > "$UNIT_FILE" << EOF
[Unit]
Description=MinIO Object Storage (DescompliCAR)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
Environment="MINIO_ROOT_USER=minioadmin"
Environment="MINIO_ROOT_PASSWORD=minioadmin"
ExecStart=$MINIO_BIN server $PROJECT_ROOT/minio-data --address ":9000" --console-address ":9001"
WorkingDirectory=$PROJECT_ROOT
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

echo "Unit criada: $UNIT_FILE"
systemctl daemon-reload
systemctl enable minio-descomplicar
systemctl start minio-descomplicar

echo ""
echo "MinIO instalado e rodando como serviço."
echo "  Status:  systemctl status minio-descomplicar"
echo "  Parar:   systemctl stop minio-descomplicar"
echo "  Logs:    journalctl -u minio-descomplicar -f"
echo "  Console: http://localhost:9001 (minioadmin/minioadmin)"
echo "  API:     http://localhost:9000"
echo ""

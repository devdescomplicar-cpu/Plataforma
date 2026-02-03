#!/bin/bash
# Iniciar MinIO em background
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin minio server /app/minio-data --address ":9000" --console-address ":9001" > /tmp/minio.log 2>&1 &
MINIO_PID=$!
echo "MinIO iniciado (PID: $MINIO_PID)"

# Aguardar MinIO iniciar
sleep 3

# Iniciar servidor backend
cd /app/server
export DATABASE_URL="postgresql://postgres@localhost:5432/descomplicar"
export MINIO_ENDPOINT="localhost"
export MINIO_PORT=9000
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
export MINIO_BUCKET="vehicle-images"
export MINIO_USE_SSL=false
export JWT_SECRET="descompliCAR_jwt_secret_2026_change_in_production"
export JWT_EXPIRES_IN="7d"
export PORT=3001
export NODE_ENV=development
npm run dev &
SERVER_PID=$!
echo "Servidor iniciado (PID: $SERVER_PID)"

# Aguardar servidor iniciar
sleep 3

# Iniciar frontend
cd /app
npm run dev &
FRONTEND_PID=$!
echo "Frontend iniciado (PID: $FRONTEND_PID)"

echo ""
echo "=========================================="
echo "Serviços iniciados:"
echo "- MinIO: http://localhost:9000"
echo "- Backend API: http://localhost:3001"
echo "- Frontend: http://localhost:3000"
echo "=========================================="
echo ""
echo "Para parar todos os serviços, pressione Ctrl+C"

wait

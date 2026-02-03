#!/bin/bash
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
npm run dev

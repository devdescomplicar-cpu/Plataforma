#!/usr/bin/env bash
# Full dump do banco PostgreSQL usando credenciais do .env.
# Salva em backup/ com nome db-YYYY-MM-DD-HHmmss.dump (formato custom pg_restore).
#
# Uso: ./scripts/backup-db.sh   (a partir da raiz do projeto, ou com path absoluto)
# Requer: pg_dump no PATH (PostgreSQL client tools).

set -e

# Evita avisos de locale do Perl (pg_dump em alguns sistemas)
export LC_ALL=C.UTF-8
export LANG=C.UTF-8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backup"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "Arquivo .env não encontrado em $PROJECT_ROOT" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$PROJECT_ROOT/.env"
set +a

if [ -z "$DATABASE_URL" ] || [[ ! "$DATABASE_URL" =~ ^postgresql ]]; then
  echo "DATABASE_URL não definida ou inválida no .env" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# db-YYYYMMDD-HHmmss.dump
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/db-$TIMESTAMP.dump"

if ! command -v pg_dump &>/dev/null; then
  echo "pg_dump não encontrado. Instale PostgreSQL client tools." >&2
  exit 1
fi

pg_dump -Fc -f "$OUT_FILE" "$DATABASE_URL"

echo "Backup concluído: $OUT_FILE"

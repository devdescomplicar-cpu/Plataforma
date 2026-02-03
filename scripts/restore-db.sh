#!/usr/bin/env bash
# Restaura banco PostgreSQL a partir de um dump em backup/.
# Usa credenciais do .env.
#
# Uso:
#   ./scripts/restore-db.sh                    → restaura o backup mais recente
#   ./scripts/restore-db.sh backup/db-20250201-143022.dump  → restaura arquivo específico
#
# Requer: pg_restore no PATH (PostgreSQL client tools).

set -e

# Evita avisos de locale do Perl (pg_restore em alguns sistemas)
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

if ! command -v pg_restore &>/dev/null; then
  echo "pg_restore não encontrado. Instale PostgreSQL client tools." >&2
  exit 1
fi

DUMP_FILE=""

if [ -n "$1" ]; then
  if [ -f "$1" ]; then
    DUMP_FILE="$1"
  elif [ -f "$PROJECT_ROOT/$1" ]; then
    DUMP_FILE="$PROJECT_ROOT/$1"
  else
    echo "Arquivo não encontrado: $1" >&2
    exit 1
  fi
else
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "Pasta backup/ não existe." >&2
    exit 1
  fi
  # GNU find: -printf; fallback (macOS/BSD): ls -t
  if find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -printf '.' 2>/dev/null | grep -q .; then
    LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
  fi
  if [ -z "$LATEST" ]; then
    LATEST="$(ls -t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1)"
  fi
  if [ -z "$LATEST" ] || [ ! -f "$LATEST" ]; then
    echo "Nenhum arquivo .dump em backup/" >&2
    exit 1
  fi
  DUMP_FILE="$LATEST"
  echo "Usando backup mais recente: $DUMP_FILE"
fi

# pg_restore pode retornar 1 por avisos (ex.: role não existe); não abortar por set -e
if ! pg_restore --clean --if-exists -d "$DATABASE_URL" "$DUMP_FILE"; then
  EXIT_CODE=$?
  echo "Aviso: pg_restore retornou $EXIT_CODE (alguns avisos são normais, ex.: roles). Verifique o banco se necessário." >&2
  exit $EXIT_CODE
fi

echo "Restauração concluída."

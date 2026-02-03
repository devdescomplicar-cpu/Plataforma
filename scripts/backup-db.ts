/**
 * Full dump do banco PostgreSQL usando credenciais do .env.
 * Salva em backup/ com nome db-YYYY-MM-DD-HHmmss.dump (formato custom pg_restore).
 *
 * Uso: npm run backup:db   (a partir da raiz do projeto)
 * Requer: pg_dump no PATH (PostgreSQL client tools).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = path.join(projectRoot, "backup");

if (!DATABASE_URL?.startsWith("postgresql")) {
  console.error("DATABASE_URL não definida ou inválida no .env");
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .slice(0, 15)
  .replace("T", "-");
const outFile = path.join(BACKUP_DIR, `db-${timestamp}.dump`);

const result = spawnSync(
  "pg_dump",
  ["-Fc", "-f", outFile, DATABASE_URL],
  { stdio: "inherit", shell: false }
);

if (result.status !== 0) {
  console.error("pg_dump falhou. Verifique PostgreSQL client tools e DATABASE_URL.");
  process.exit(result.status ?? 1);
}

console.log("Backup concluído:", outFile);

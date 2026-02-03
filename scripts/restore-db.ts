/**
 * Restaura banco PostgreSQL a partir de um dump em backup/.
 * Usa credenciais do .env.
 *
 * Uso:
 *   npm run restore:db              → restaura o backup mais recente
 *   npm run restore:db -- backup/db-20250201-143022.dump  → restaura arquivo específico
 *
 * Requer: pg_restore no PATH (PostgreSQL client tools).
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

const argFile = process.argv.slice(2).find((a) => !a.startsWith("-"));
let dumpFile: string;

if (argFile && fs.existsSync(path.isAbsolute(argFile) ? argFile : path.join(projectRoot, argFile))) {
  dumpFile = path.isAbsolute(argFile) ? argFile : path.join(projectRoot, argFile);
} else if (fs.existsSync(BACKUP_DIR)) {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) {
    console.error("Nenhum arquivo .dump em backup/");
    process.exit(1);
  }
  dumpFile = path.join(BACKUP_DIR, files[0].name);
  console.log("Usando backup mais recente:", dumpFile);
} else {
  console.error("Pasta backup/ não existe ou não foi informado um arquivo .dump");
  process.exit(1);
}

const result = spawnSync(
  "pg_restore",
  ["--clean", "--if-exists", "-d", DATABASE_URL, dumpFile],
  { stdio: "inherit", shell: false }
);

if (result.status !== 0) {
  console.error("pg_restore finalizou com erros (alguns avisos são esperados). Verifique o banco.");
  process.exit(result.status ?? 1);
}

console.log("Restauração concluída.");

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// PGlite persiste em ./pgdata — Postgres real embutido, sem servidor.
// Singleton global para sobreviver ao hot-reload do Next em dev.
const globalForDb = globalThis as unknown as {
  pglite?: PGlite;
};

// Diretórios internos que o Postgres exige para iniciar, mas que o
// rastreador de arquivos do Next (outputFileTracingIncludes) descarta por
// estarem vazios no momento do build. Recriamos aqui depois de copiar.
const REQUIRED_EMPTY_DIRS = [
  "pg_commit_ts", "pg_dynshmem", "pg_notify", "pg_replslot", "pg_serial",
  "pg_snapshots", "pg_stat", "pg_stat_tmp", "pg_tblspc", "pg_twophase",
  "pg_logical/mappings", "pg_logical/snapshots",
  "pg_wal/archive_status", "pg_wal/summaries",
];

// Na Vercel o filesystem do deploy é somente leitura (exceto /tmp) e cada
// instância é efêmera. Por isso copiamos o ./pgdata semeado no build (ver
// package.json "build") para /tmp na primeira execução da instância — o
// app sobe com dados de demonstração, mas eles não persistem entre
// instâncias/cold starts.
function resolveDataDir() {
  if (!process.env.VERCEL) return "./pgdata";

  const runtimeDir = "/tmp/pgdata";
  if (!fs.existsSync(runtimeDir)) {
    const seedDir = path.join(process.cwd(), "pgdata");
    if (fs.existsSync(seedDir)) {
      fs.cpSync(seedDir, runtimeDir, { recursive: true });
      for (const dir of REQUIRED_EMPTY_DIRS) {
        fs.mkdirSync(path.join(runtimeDir, dir), { recursive: true });
      }
    }
  }
  return runtimeDir;
}

const client = globalForDb.pglite ?? new PGlite(resolveDataDir());
globalForDb.pglite = client;

export const db = drizzle(client, { schema });
export { schema };

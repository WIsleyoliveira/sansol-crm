import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// PGlite persiste em ./pgdata — Postgres real embutido, sem servidor.
// Singleton global para sobreviver ao hot-reload do Next em dev.
const globalForDb = globalThis as unknown as {
  pglite?: PGlite;
};

// Na Vercel o filesystem do deploy é somente leitura (exceto /tmp) e cada
// instância é efêmera. Por isso extraímos o pgdata.tar semeado no build
// (ver package.json "build") para /tmp na primeira execução da instância —
// o app sobe com dados de demonstração, mas eles não persistem entre
// instâncias/cold starts.
function resolveDataDir() {
  if (!process.env.VERCEL) return "./pgdata";

  const runtimeDir = "/tmp/pgdata";
  if (!fs.existsSync(runtimeDir)) {
    const tarPath = path.join(process.cwd(), "pgdata.tar");
    if (fs.existsSync(tarPath)) {
      fs.mkdirSync(runtimeDir, { recursive: true });
      execFileSync("tar", ["-xf", tarPath, "-C", "/tmp"]);
    }
  }
  return runtimeDir;
}

const client = globalForDb.pglite ?? new PGlite(resolveDataDir());
globalForDb.pglite = client;

export const db = drizzle(client, { schema });
export { schema };

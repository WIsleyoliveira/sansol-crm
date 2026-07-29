import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

// PGlite persiste em ./pgdata — Postgres real embutido, sem servidor.
// Singleton global para sobreviver ao hot-reload do Next em dev.
const globalForDb = globalThis as unknown as {
  pglite?: PGlite;
};

const client = globalForDb.pglite ?? new PGlite("./pgdata");
globalForDb.pglite = client;

export const db = drizzle(client, { schema });
export { schema };

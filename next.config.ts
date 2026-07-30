import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  output: "standalone",
  // Empacota o banco PGlite semeado no build (ver src/db/index.ts) para que
  // o deploy suba com dados de demonstração em vez de vazio. É um .tar (e
  // não a pasta pgdata/ crua) porque o rastreador de arquivos do Next
  // descarta diretórios vazios, e o Postgres exige vários deles para iniciar.
  outputFileTracingIncludes: {
    "/*": ["./pgdata.tar"],
  },
};

export default nextConfig;

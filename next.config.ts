import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  output: "standalone",
  // Empacota o banco PGlite semeado no build (ver src/db/index.ts) para que
  // o deploy suba com dados de demonstração em vez de vazio.
  outputFileTracingIncludes: {
    "/*": ["./pgdata/**/*"],
  },
};

export default nextConfig;

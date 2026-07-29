#!/bin/bash
set -e

# Cria os bancos separados para n8n e Evolution API dentro do mesmo Postgres.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE n8n'      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec
    SELECT 'CREATE DATABASE evolution' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
EOSQL

echo "Bancos 'n8n' e 'evolution' prontos."

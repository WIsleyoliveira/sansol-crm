# Sansol CRM ☀️

CRM vertical para venda e instalação de energia solar — do lead ao sistema ligado.

## Stack

- **Next.js 16** (App Router, Server Actions, React Server Components)
- **Drizzle ORM + PGlite** — Postgres real embutido (arquivo local em `./pgdata`), sem Docker e sem servidor. O schema é 100% Postgres: migrar para Supabase/RDS depois é trocar o driver.
- **Tailwind CSS**
- Auth mockada por cookie (usuários seedados) — trocar por auth real quando sair do protótipo.

## Rodando

```bash
npm install
npm run db:push   # cria o schema no PGlite
npm run db:seed   # popula com dados de demonstração da Sansol
npm run dev       # http://localhost:3000
```

Entre em `/login` escolhendo um dos perfis (owner, gerente, vendedores, técnico de campo).

> Para resetar o banco: apague a pasta `pgdata/` e rode `db:push` + `db:seed` de novo.

## Modelo de dados

Multi-tenant (shared schema + `workspace_id` em toda tabela). Núcleo CRM:
`workspaces`, `users`, `workspace_members` (papéis: owner/admin/manager/rep/installer/viewer),
`companies`, `contacts`, `pipelines`, `pipeline_stages`, `opportunities`,
`opportunity_stage_history` (velocity/conversão de funil), `tasks`, `activities` (log append-only, inclui ações de agentes IA).

Vertical solar:
`sites` (imóvel/telhado/consumo), `site_surveys` (visita técnica), `proposals` (kWp, equipamentos, payback, financiamento),
`installation_projects` (homologação → concessionária → instalação → sistema ligado), `equipment_catalog`.

## Regras de negócio implementadas

- **Dois pipelines encadeados**: Vendas e Projeto/Instalação. Ao mover uma oportunidade para "Contrato assinado" (etapa `is_won`), um workflow cria automaticamente o projeto de instalação no primeiro estágio do pipeline de instalação, vinculando o site da empresa.
- **Histórico de estágio**: toda mudança grava `opportunity_stage_history` com tempo na etapa.
- **SLA por etapa**: cards no kanban ficam com borda vermelha e ⚠ quando o tempo na etapa estoura o `sla_days`.
- **Forecast ponderado**: dashboard soma `amount × probability` da etapa.
- Toda ação relevante vira `activity` na timeline (usuário, sistema ou agente IA).

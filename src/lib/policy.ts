export type Role = "owner" | "admin" | "manager" | "rep" | "installer" | "viewer";

// Capacidades por papel. Cada módulo tem uma capability própria:
//  - view_pipeline / manage_records → Vendas
//  - view_financials               → Financeiro (ERP)
//  - view_engineering              → Engenharia
//  - view_installs / view_ops      → Operações
//  - view_aftersales               → Pós-vendas
// installer = técnico de campo: opera OS e instalações, não vê comercial/financeiro.
const capabilities: Record<Role, Set<string>> = {
  owner: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "view_ops", "view_engineering", "view_aftersales", "use_ai", "use_whatsapp"]),
  admin: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "view_ops", "view_engineering", "view_aftersales", "use_ai", "use_whatsapp"]),
  manager: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "view_ops", "view_engineering", "view_aftersales", "use_ai", "use_whatsapp"]),
  rep: new Set(["view_pipeline", "manage_records", "view_installs", "view_engineering", "view_aftersales", "use_ai", "use_whatsapp"]),
  installer: new Set(["view_installs", "view_ops", "use_whatsapp"]),
  viewer: new Set(["view_pipeline", "view_installs", "view_engineering", "view_aftersales"]),
};

export function can(role: string, action: string): boolean {
  return capabilities[role as Role]?.has(action) ?? false;
}

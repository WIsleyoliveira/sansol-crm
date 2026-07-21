export type Role = "owner" | "admin" | "manager" | "rep" | "installer" | "viewer";

// Capacidades por papel. installer = técnico de campo: opera instalações e
// tarefas, mas não vê valores comerciais nem o funil de vendas.
const capabilities: Record<Role, Set<string>> = {
  owner: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai", "use_whatsapp"]),
  admin: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai", "use_whatsapp"]),
  manager: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai", "use_whatsapp"]),
  rep: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai", "use_whatsapp"]),
  installer: new Set(["view_installs", "use_whatsapp"]),
  viewer: new Set(["view_pipeline", "view_installs"]),
};

export function can(role: string, action: string): boolean {
  return capabilities[role as Role]?.has(action) ?? false;
}

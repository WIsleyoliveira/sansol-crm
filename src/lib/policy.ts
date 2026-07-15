export type Role = "owner" | "admin" | "manager" | "rep" | "installer" | "viewer";

// Capacidades por papel. installer = técnico de campo: opera instalações e
// tarefas, mas não vê valores comerciais nem o funil de vendas.
const capabilities: Record<Role, Set<string>> = {
  owner: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai"]),
  admin: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai"]),
  manager: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai"]),
  rep: new Set(["view_pipeline", "view_financials", "manage_records", "view_installs", "use_ai"]),
  installer: new Set(["view_installs"]),
  viewer: new Set(["view_pipeline", "view_installs"]),
};

export function can(role: string, action: string): boolean {
  return capabilities[role as Role]?.has(action) ?? false;
}

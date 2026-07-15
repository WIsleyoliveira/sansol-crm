import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { loginAs } from "@/app/actions";

const roleLabel: Record<string, string> = {
  owner: "Proprietária", admin: "Admin", manager: "Gerente comercial",
  rep: "Vendedor(a)", installer: "Técnico de campo", viewer: "Visualização",
};

export default async function LoginPage() {
  const members = await db
    .select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.workspaceMembers.role })
    .from(s.users)
    .innerJoin(s.workspaceMembers, eq(s.workspaceMembers.userId, s.users.id));

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-amber-400 flex items-center justify-center text-xl">☀️</div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Sansol CRM</h1>
            <p className="text-sm text-zinc-500">Energia solar, do lead ao sistema ligado</p>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mb-6 mt-4 uppercase tracking-wide font-medium">
          Ambiente de demonstração — entre como:
        </p>
        <div className="space-y-2">
          {members.map((m) => (
            <form key={m.id} action={loginAs.bind(null, m.id)}>
              <button className="w-full flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-amber-400 hover:bg-amber-50 transition">
                <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center font-semibold text-zinc-600">
                  {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-zinc-900">{m.name}</div>
                  <div className="text-xs text-zinc-500">{roleLabel[m.role] ?? m.role} · {m.email}</div>
                </div>
                <span className="text-zinc-300">→</span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}

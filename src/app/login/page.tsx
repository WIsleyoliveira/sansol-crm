import { eq } from "drizzle-orm";
import { ArrowRight, Sun } from "lucide-react";
import { db, schema as s } from "@/db";
import { loginAs } from "@/app/actions";

export const dynamic = "force-dynamic";

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
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* brilho solar de fundo */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-amber-500/20 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-[300px] w-[400px] rounded-full bg-orange-600/10 blur-[100px]" />

      <div className="relative w-full max-w-md rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Sun className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Sansol CRM</h1>
            <p className="text-sm text-zinc-400">Energia solar, do lead ao sistema ligado</p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mb-5 mt-6 uppercase tracking-widest font-semibold">
          Ambiente de demonstração — entre como
        </p>
        <div className="space-y-2">
          {members.map((m) => (
            <form key={m.id} action={loginAs.bind(null, m.id)}>
              <button className="group w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.08] hover:border-amber-400/40 transition-all">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 group-hover:from-amber-400 group-hover:to-orange-500 flex items-center justify-center font-semibold text-sm text-white transition-all">
                  {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white text-sm">{m.name}</div>
                  <div className="text-xs text-zinc-500">{roleLabel[m.role] ?? m.role} · {m.email}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}

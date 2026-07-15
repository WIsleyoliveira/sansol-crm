import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { logout } from "@/app/actions";

const nav = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/pipeline", label: "Pipeline de Vendas", icon: "🎯" },
  { href: "/projetos", label: "Projetos / Instalação", icon: "🔧" },
  { href: "/empresas", label: "Empresas", icon: "🏢" },
  { href: "/contatos", label: "Contatos", icon: "👥" },
  { href: "/tarefas", label: "Tarefas", icon: "✅" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="w-60 shrink-0 bg-zinc-900 text-zinc-300 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-zinc-800">
          <span className="text-2xl">☀️</span>
          <div>
            <div className="font-bold text-white leading-tight">Sansol CRM</div>
            <div className="text-[11px] text-zinc-500">{user.workspaceName}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-800 hover:text-white transition">
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-zinc-800 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500 text-zinc-900 flex items-center justify-center text-xs font-bold">
            {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">{user.name}</div>
            <div className="text-[11px] text-zinc-500 capitalize">{user.role}</div>
          </div>
          <form action={logout}>
            <button title="Sair" className="text-zinc-500 hover:text-white text-sm">⎋</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

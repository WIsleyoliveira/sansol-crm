import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, gt, sql } from "drizzle-orm";
import {
  LayoutDashboard, Target, Wrench, Building2, Users, CheckSquare, LogOut, Sun, MessageCircle,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { logout } from "@/app/actions";
import { db, schema as s } from "@/db";

const allNav = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard, needs: "view_pipeline" },
  { href: "/pipeline", label: "Pipeline de Vendas", Icon: Target, needs: "view_pipeline" },
  { href: "/projetos", label: "Projetos / Instalação", Icon: Wrench, needs: "view_installs" },
  { href: "/whatsapp", label: "WhatsApp", Icon: MessageCircle, needs: "use_whatsapp" },
  { href: "/empresas", label: "Empresas", Icon: Building2, needs: "view_pipeline" },
  { href: "/contatos", label: "Contatos", Icon: Users, needs: "view_pipeline" },
  { href: "/tarefas", label: "Tarefas", Icon: CheckSquare, needs: "view_installs" },
];

const roleLabel: Record<string, string> = {
  owner: "Proprietária", admin: "Admin", manager: "Gerente",
  rep: "Vendas", installer: "Técnico de campo", viewer: "Leitura",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const nav = allNav.filter((n) => can(user.role, n.needs));

  const [unread] = can(user.role, "use_whatsapp")
    ? await db.select({ total: sql<number>`coalesce(sum(${s.whatsappConversations.unreadCount}), 0)` })
        .from(s.whatsappConversations)
        .where(eq(s.whatsappConversations.workspaceId, user.workspaceId))
    : [{ total: 0 }];

  return (
    <div className="flex h-screen">
      <aside className="w-64 shrink-0 bg-zinc-950 text-zinc-400 flex flex-col border-r border-zinc-900">
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Sun className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-bold text-white leading-tight tracking-tight">Sansol CRM</div>
            <div className="text-[11px] text-zinc-500">{user.workspaceName}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {nav.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium hover:bg-zinc-900 hover:text-white transition-colors">
              <Icon className="h-4 w-4 text-zinc-500 group-hover:text-amber-400 transition-colors" strokeWidth={2} />
              <span className="flex-1">{label}</span>
              {href === "/whatsapp" && Number(unread.total) > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread.total}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mx-3 mb-3 rounded-xl bg-zinc-900/80 px-3 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow">
            {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white truncate">{user.name}</div>
            <div className="text-[11px] text-zinc-500">{roleLabel[user.role] ?? user.role}</div>
          </div>
          <form action={logout}>
            <button title="Sair" className="text-zinc-500 hover:text-white transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}

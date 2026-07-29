import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { LifeBuoy, MessageCircle, Phone, Mail, Globe } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { relTime } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";
import { setTicketStatus } from "@/app/actions-aftersales";

const statusTone: Record<string, "green" | "amber" | "blue" | "zinc"> = { resolved: "green", in_progress: "blue", open: "amber", closed: "zinc" };
const statusLabel: Record<string, string> = { resolved: "Resolvido", in_progress: "Em atendimento", open: "Aberto", closed: "Fechado" };
const prioTone: Record<string, "red" | "amber" | "blue" | "zinc"> = { urgent: "red", high: "amber", normal: "blue", low: "zinc" };
const channelIcon: Record<string, React.ComponentType<{ className?: string }>> = { portal: Globe, whatsapp: MessageCircle, phone: Phone, email: Mail };

export default async function ChamadosPage() {
  const user = await requireUser();
  if (!can(user.role, "view_aftersales")) redirect("/");

  const rows = await db.select({ t: s.tickets, companyName: s.companies.name, plantName: s.plants.name, agentName: s.users.name })
    .from(s.tickets)
    .leftJoin(s.companies, eq(s.companies.id, s.tickets.companyId))
    .leftJoin(s.plants, eq(s.plants.id, s.tickets.plantId))
    .leftJoin(s.users, eq(s.users.id, s.tickets.assignedTo))
    .where(eq(s.tickets.workspaceId, user.workspaceId))
    .orderBy(desc(s.tickets.createdAt));

  const open = rows.filter((r) => r.t.status === "open" || r.t.status === "in_progress");
  const urgent = rows.filter((r) => r.t.priority === "urgent" && r.t.status !== "resolved");

  return (
    <div className="p-8 space-y-6 max-w-[1300px]">
      <PageHeader module="Pós-vendas" title="Chamados / Suporte"
        subtitle="Atendimentos abertos pelos clientes (portal, WhatsApp, telefone). Vinculados à usina monitorada." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Chamados abertos" value={String(open.length)} Icon={LifeBuoy} tint="bg-sky-50 text-sky-600" />
        <Kpi label="Urgentes" value={String(urgent.length)} tint="bg-red-50 text-red-600" />
        <Kpi label="Resolvidos" value={String(rows.filter((r) => r.t.status === "resolved").length)} tint="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="space-y-3">
        {rows.map(({ t, companyName, plantName, agentName }) => {
          const CIcon = channelIcon[t.channel] ?? Globe;
          return (
            <div key={t.id} className={`${card} p-5 flex flex-col md:flex-row md:items-start gap-4`}>
              <div className="h-10 w-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center shrink-0"><CIcon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-800 text-[14px]">{t.subject}</span>
                  <Badge tone={prioTone[t.priority]}>{t.priority}</Badge>
                  <Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge>
                </div>
                <div className="text-[13px] text-zinc-500 mt-1">{t.description}</div>
                <div className="text-xs text-zinc-400 mt-1.5">
                  {companyName}{plantName ? ` · ${plantName}` : ""} · via {t.channel} · {relTime(t.createdAt)}{agentName ? ` · resp. ${agentName.split(" ")[0]}` : ""}
                </div>
              </div>
              {t.status !== "resolved" && t.status !== "closed" && (
                <div className="flex gap-2 shrink-0">
                  {t.status === "open" && (
                    <form action={setTicketStatus.bind(null, t.id, "in_progress")}>
                      <button className="rounded-lg bg-sky-600 text-white text-xs font-semibold px-3 py-2 hover:bg-sky-500 transition-colors whitespace-nowrap">Atender</button>
                    </form>
                  )}
                  <form action={setTicketStatus.bind(null, t.id, "resolved")}>
                    <button className="rounded-lg bg-emerald-600 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-500 transition-colors whitespace-nowrap">Resolver</button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className={card}><EmptyState title="Nenhum chamado." /></div>}
      </div>
    </div>
  );
}

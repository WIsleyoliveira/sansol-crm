import { redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { can } from "@/lib/policy";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { moveOpportunityStage } from "@/app/actions";
import { Kanban, type KanbanColumn } from "@/components/Kanban";
import { brl, daysSince } from "@/lib/format";

export default async function PipelinePage() {
  const user = await requireUser();
  if (!can(user.role, "view_pipeline")) redirect("/projetos");

  const [pipe] = await db.select().from(s.pipelines)
    .where(and(eq(s.pipelines.workspaceId, user.workspaceId), eq(s.pipelines.kind, "sales")));

  const stages = await db.select().from(s.pipelineStages)
    .where(eq(s.pipelineStages.pipelineId, pipe.id)).orderBy(asc(s.pipelineStages.order));

  const opps = await db
    .select({
      opp: s.opportunities,
      companyName: s.companies.name,
      ownerName: s.users.name,
    })
    .from(s.opportunities)
    .leftJoin(s.companies, eq(s.companies.id, s.opportunities.companyId))
    .leftJoin(s.users, eq(s.users.id, s.opportunities.ownerId))
    .where(eq(s.opportunities.workspaceId, user.workspaceId));

  const columns: KanbanColumn[] = stages.map((st) => ({
    id: st.id,
    name: st.name,
    probability: st.probability,
    isTerminal: st.isWon || st.isLost,
    totalText: brl(
      opps.filter((o) => o.opp.stageId === st.id)
        .reduce((a, o) => a + parseFloat(o.opp.amount ?? "0"), 0)
    ),
    cards: opps
      .filter((o) => o.opp.stageId === st.id)
      .map((o) => ({
        id: o.opp.id,
        href: `/oportunidades/${o.opp.id}`,
        title: o.companyName ?? o.opp.name,
        subtitle: o.opp.leadSource ?? undefined,
        amount: brl(o.opp.amount),
        badge: o.opp.systemSizeKwp ? `${parseFloat(o.opp.systemSizeKwp)} kWp` : undefined,
        daysInStage: daysSince(o.opp.stageEnteredAt),
        slaDays: st.slaDays,
        ownerInitials: o.ownerName?.split(" ").map((p) => p[0]).slice(0, 2).join(""),
      })),
  }));

  async function move(cardId: string, toColumnId: string) {
    "use server";
    await moveOpportunityStage(cardId, toColumnId);
  }

  const openTotal = opps.filter((o) => o.opp.status === "open")
    .reduce((acc, o) => acc + parseFloat(o.opp.amount ?? "0"), 0);

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Pipeline de Vendas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Arraste os cards para mudar de etapa · borda vermelha indica SLA estourado</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Em aberto</div>
            <div className="text-lg font-bold text-emerald-700 tabular-nums">{brl(openTotal)}</div>
          </div>
          <Link href="/oportunidades/nova"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-4 py-2.5 hover:bg-zinc-700 shadow-sm transition-colors">
            <Plus className="h-4 w-4" /> Nova oportunidade
          </Link>
        </div>
      </div>
      <Kanban columns={columns} moveAction={move} />
    </div>
  );
}

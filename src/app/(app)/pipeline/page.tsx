import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { moveOpportunityStage } from "@/app/actions";
import { Kanban, type KanbanColumn } from "@/components/Kanban";
import { brl, daysSince } from "@/lib/format";

export default async function PipelinePage() {
  const user = await requireUser();

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
    <div className="p-6">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Pipeline de Vendas</h1>
          <p className="text-sm text-zinc-500">Arraste os cards para mudar de etapa · ⚠ indica SLA estourado</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-400 uppercase">Em aberto</div>
          <div className="text-lg font-bold text-emerald-700">{brl(openTotal)}</div>
        </div>
      </div>
      <Kanban columns={columns} moveAction={move} />
    </div>
  );
}

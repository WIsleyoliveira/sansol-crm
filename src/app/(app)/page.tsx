import Link from "next/link";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { brl, dateBR, daysSince, relTime } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();
  const ws = eq(s.opportunities.workspaceId, user.workspaceId);

  const opps = await db.select({
    opp: s.opportunities,
    stageName: s.pipelineStages.name,
    probability: s.pipelineStages.probability,
    companyName: s.companies.name,
  }).from(s.opportunities)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.opportunities.stageId))
    .leftJoin(s.companies, eq(s.companies.id, s.opportunities.companyId))
    .where(ws);

  const open = opps.filter((o) => o.opp.status === "open");
  const won = opps.filter((o) => o.opp.status === "won");
  const pipelineTotal = open.reduce((a, o) => a + parseFloat(o.opp.amount ?? "0"), 0);
  const forecast = open.reduce((a, o) => a + parseFloat(o.opp.amount ?? "0") * (o.probability / 100), 0);
  const wonTotal = won.reduce((a, o) => a + parseFloat(o.opp.amount ?? "0"), 0);
  const totalKwpWon = won.reduce((a, o) => a + parseFloat(o.opp.systemSizeKwp ?? "0"), 0);

  const myTasks = await db.select().from(s.tasks)
    .where(and(eq(s.tasks.workspaceId, user.workspaceId), isNull(s.tasks.completedAt)))
    .orderBy(asc(s.tasks.dueAt)).limit(6);

  const recent = await db.select({
    act: s.activities,
    actorName: s.users.name,
  }).from(s.activities)
    .leftJoin(s.users, eq(s.users.id, s.activities.actorId))
    .where(eq(s.activities.workspaceId, user.workspaceId))
    .orderBy(desc(s.activities.createdAt)).limit(8);

  const stalled = open.filter((o) => daysSince(o.opp.stageEnteredAt) > 10);

  const kpis = [
    { label: "Pipeline aberto", value: brl(pipelineTotal), sub: `${open.length} negócios` },
    { label: "Forecast ponderado", value: brl(forecast), sub: "por probabilidade da etapa" },
    { label: "Vendido (total)", value: brl(wonTotal), sub: `${won.length} contratos` },
    { label: "Potência vendida", value: `${totalKwpWon.toLocaleString("pt-BR")} kWp`, sub: "sistemas contratados" },
  ];

  const typeLabel: Record<string, string> = {
    note: "📝 Nota", call_logged: "📞 Ligação", stage_changed: "🎯 Mudança de etapa",
    ai_suggestion: "🤖 Sugestão IA", project_created: "⚙️ Workflow", installation_stage_changed: "🔧 Instalação",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Bom dia, {user.name.split(" ")[0]} ☀️</h1>
        <p className="text-sm text-zinc-500">Visão geral da operação Sansol</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-white border border-zinc-200 p-4">
            <div className="text-xs text-zinc-400 uppercase tracking-wide">{k.label}</div>
            <div className="text-2xl font-bold text-zinc-900 mt-1">{k.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl bg-white border border-zinc-200">
          <div className="px-4 py-3 border-b border-zinc-100 font-semibold text-sm text-zinc-700">Minhas tarefas</div>
          <div className="divide-y divide-zinc-100">
            {myTasks.map((t) => {
              const overdue = t.dueAt && new Date(t.dueAt) < new Date();
              return (
                <div key={t.id} className="px-4 py-2.5">
                  <div className="text-sm text-zinc-800 leading-snug">
                    {t.createdByAgent && <span className="text-[10px] rounded bg-violet-100 text-violet-700 px-1 py-0.5 mr-1.5 font-semibold">IA</span>}
                    {t.title}
                  </div>
                  <div className={`text-xs mt-0.5 ${overdue ? "text-red-600 font-medium" : "text-zinc-400"}`}>
                    {t.dueAt ? `vence ${relTime(t.dueAt)}` : "sem prazo"}{overdue ? " · atrasada" : ""}
                  </div>
                </div>
              );
            })}
            {myTasks.length === 0 && <div className="px-4 py-6 text-sm text-zinc-400">Nenhuma tarefa aberta 🎉</div>}
          </div>
          <Link href="/tarefas" className="block px-4 py-2.5 text-xs text-amber-600 font-medium border-t border-zinc-100 hover:bg-amber-50">
            Ver todas →
          </Link>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200">
          <div className="px-4 py-3 border-b border-zinc-100 font-semibold text-sm text-zinc-700">
            ⚠️ Negócios parados <span className="text-zinc-400 font-normal">(+10 dias na etapa)</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {stalled.map((o) => (
              <Link key={o.opp.id} href={`/oportunidades/${o.opp.id}`} className="block px-4 py-2.5 hover:bg-zinc-50">
                <div className="text-sm text-zinc-800">{o.companyName ?? o.opp.name}</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {o.stageName} · há {daysSince(o.opp.stageEnteredAt)} dias · {brl(o.opp.amount)}
                </div>
              </Link>
            ))}
            {stalled.length === 0 && <div className="px-4 py-6 text-sm text-zinc-400">Nenhum negócio travado.</div>}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200">
          <div className="px-4 py-3 border-b border-zinc-100 font-semibold text-sm text-zinc-700">Atividade recente</div>
          <div className="divide-y divide-zinc-100">
            {recent.map((r) => (
              <div key={r.act.id} className="px-4 py-2.5">
                <div className="text-xs text-zinc-500">
                  {typeLabel[r.act.type] ?? r.act.type} · {r.act.actorType === "ai_agent" ? "Agente IA" : r.act.actorType === "system" ? "Sistema" : r.actorName} · {relTime(r.act.createdAt)}
                </div>
                {(r.act.payload as { text?: string; to?: string }).text && (
                  <div className="text-sm text-zinc-700 mt-0.5 line-clamp-2">{(r.act.payload as { text?: string }).text}</div>
                )}
                {(r.act.payload as { to?: string }).to && (
                  <div className="text-sm text-zinc-700 mt-0.5">→ {(r.act.payload as { to?: string }).to}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-zinc-200 p-4">
        <div className="font-semibold text-sm text-zinc-700 mb-3">Próximos fechamentos esperados</div>
        <div className="grid gap-2">
          {open
            .sort((a, b) => new Date(a.opp.expectedCloseDate ?? 0).getTime() - new Date(b.opp.expectedCloseDate ?? 0).getTime())
            .slice(0, 5)
            .map((o) => (
              <Link key={o.opp.id} href={`/oportunidades/${o.opp.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 hover:border-amber-300 hover:bg-amber-50/40 transition">
                <div className="text-sm text-zinc-800">{o.companyName ?? o.opp.name}</div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>{o.stageName}</span>
                  <span className="font-semibold text-emerald-700">{brl(o.opp.amount)}</span>
                  <span>{dateBR(o.opp.expectedCloseDate)}</span>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

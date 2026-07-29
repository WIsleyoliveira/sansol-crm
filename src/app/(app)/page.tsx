import { redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  AlertTriangle, ArrowRight, Banknote, CalendarClock, ListChecks, Megaphone,
  Phone, Settings2, Sparkles, StickyNote, Target, TrendingUp, Wrench, Zap,
} from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { brl, dateBR, daysSince, relTime } from "@/lib/format";
import { AiButton } from "@/components/AiButton";
import { aiAnalyzePipeline } from "@/app/actions-ai";

export default async function DashboardPage() {
  const user = await requireUser();
  // Quem não vê o funil comercial vai para a sua tela de trabalho:
  // o SDR cai na esteira de pré-venda; o técnico, nos projetos.
  if (!can(user.role, "view_pipeline")) {
    redirect(can(user.role, "view_presales") ? "/pre-vendas" : "/projetos");
  }
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

  // Gráfico "De onde vêm os leads": contagem e conversão por origem
  const bySource = new Map<string, { total: number; wonCount: number }>();
  for (const o of opps) {
    const key = o.opp.leadSource ?? "Sem origem";
    const acc = bySource.get(key) ?? { total: 0, wonCount: 0 };
    acc.total++;
    if (o.opp.status === "won") acc.wonCount++;
    bySource.set(key, acc);
  }
  const leadSources = [...bySource.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.total - a.total);
  const maxSource = Math.max(1, ...leadSources.map((l) => l.total));

  const kpis = [
    { label: "Pipeline aberto", value: brl(pipelineTotal), sub: `${open.length} negócios`, Icon: Target, tint: "bg-sky-50 text-sky-600" },
    { label: "Forecast ponderado", value: brl(forecast), sub: "por probabilidade da etapa", Icon: TrendingUp, tint: "bg-violet-50 text-violet-600" },
    { label: "Vendido (total)", value: brl(wonTotal), sub: `${won.length} contratos`, Icon: Banknote, tint: "bg-emerald-50 text-emerald-600" },
    { label: "Potência vendida", value: `${totalKwpWon.toLocaleString("pt-BR")} kWp`, sub: "sistemas contratados", Icon: Zap, tint: "bg-amber-50 text-amber-600" },
  ];

  const actIcon: Record<string, React.ReactNode> = {
    note: <StickyNote className="h-3.5 w-3.5" />,
    call_logged: <Phone className="h-3.5 w-3.5" />,
    stage_changed: <Target className="h-3.5 w-3.5" />,
    ai_suggestion: <Sparkles className="h-3.5 w-3.5" />,
    project_created: <Settings2 className="h-3.5 w-3.5" />,
    installation_stage_changed: <Wrench className="h-3.5 w-3.5" />,
  };

  const card = "rounded-2xl bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.12)]";

  return (
    <div className="p-8 space-y-6 max-w-[1500px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Bom dia, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Visão de vendas da Sansol</p>
        </div>
        <AiButton
          action={aiAnalyzePipeline}
          label="Analisar funil com IA"
          busyLabel="Analisando negócios parados…"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, Icon, tint }) => (
          <div key={label} className={`${card} p-5`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</div>
              <div className={`h-8 w-8 rounded-lg ${tint} flex items-center justify-center`}>
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-[26px] font-bold text-zinc-900 mt-2 tracking-tight">{value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className={`${card} p-5`}>
        <div className="font-semibold text-sm text-zinc-800 mb-1 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-zinc-400" />
          De onde vêm os leads
        </div>
        <p className="text-xs text-zinc-400 mb-4">Todas as oportunidades por origem — a faixa escura mostra quantas viraram venda.</p>
        <div className="space-y-2.5">
          {leadSources.map(({ source, total, wonCount }) => (
            <div key={source} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-xs font-medium text-zinc-600 truncate">{source}</div>
              <div className="flex-1 h-5 rounded-md bg-zinc-50 overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${(wonCount / maxSource) * 100}%` }} />
                <div className="h-full bg-amber-300" style={{ width: `${((total - wonCount) / maxSource) * 100}%` }} />
              </div>
              <div className="w-24 shrink-0 text-right text-xs tabular-nums text-zinc-500">
                {total} lead{total === 1 ? "" : "s"} · <span className="font-semibold text-emerald-700">{wonCount} venda{wonCount === 1 ? "" : "s"}</span>
              </div>
            </div>
          ))}
          {leadSources.length === 0 && <div className="text-sm text-zinc-400 py-4">Nenhum lead com origem registrada ainda.</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className={card}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-zinc-400" />
            <span className="font-semibold text-sm text-zinc-800">Minhas tarefas</span>
          </div>
          <div className="divide-y divide-zinc-50">
            {myTasks.map((t) => {
              const overdue = t.dueAt && new Date(t.dueAt) < new Date();
              return (
                <div key={t.id} className="px-5 py-3">
                  <div className="text-[13px] text-zinc-800 leading-snug font-medium">
                    {t.createdByAgent && (
                      <span className="inline-flex items-center gap-1 text-[10px] rounded-md bg-violet-100 text-violet-700 px-1.5 py-0.5 mr-1.5 font-semibold align-middle">
                        <Sparkles className="h-2.5 w-2.5" /> IA
                      </span>
                    )}
                    {t.title.replace(/^\[IA\]\s*/, "")}
                  </div>
                  <div className={`text-xs mt-1 ${overdue ? "text-red-600 font-medium" : "text-zinc-400"}`}>
                    {t.dueAt ? `vence ${relTime(t.dueAt)}` : "sem prazo"}{overdue ? " · atrasada" : ""}
                  </div>
                </div>
              );
            })}
            {myTasks.length === 0 && <div className="px-5 py-8 text-sm text-zinc-400">Nenhuma tarefa aberta.</div>}
          </div>
          <Link href="/tarefas" className="flex items-center gap-1 px-5 py-3 text-xs text-amber-600 font-semibold border-t border-zinc-100 hover:bg-amber-50/50 rounded-b-2xl transition-colors">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className={card}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm text-zinc-800">Negócios parados</span>
            <span className="text-xs text-zinc-400 font-normal">+10 dias na etapa</span>
          </div>
          <div className="divide-y divide-zinc-50">
            {stalled.map((o) => (
              <Link key={o.opp.id} href={`/oportunidades/${o.opp.id}`} className="block px-5 py-3 hover:bg-zinc-50/80 transition-colors">
                <div className="text-[13px] font-medium text-zinc-800">{o.companyName ?? o.opp.name}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {o.stageName} · há {daysSince(o.opp.stageEnteredAt)} dias · <span className="text-zinc-600 font-medium">{brl(o.opp.amount)}</span>
                </div>
              </Link>
            ))}
            {stalled.length === 0 && <div className="px-5 py-8 text-sm text-zinc-400">Nenhum negócio travado.</div>}
          </div>
        </div>

        <div className={card}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-zinc-400" />
            <span className="font-semibold text-sm text-zinc-800">Atividade recente</span>
          </div>
          <div className="divide-y divide-zinc-50 max-h-[420px] overflow-y-auto">
            {recent.map((r) => {
              const isAI = r.act.actorType === "ai_agent";
              return (
                <div key={r.act.id} className="px-5 py-3 flex gap-3">
                  <div className={`mt-0.5 h-6 w-6 shrink-0 rounded-md flex items-center justify-center ${isAI ? "bg-violet-100 text-violet-600" : "bg-zinc-100 text-zinc-500"}`}>
                    {actIcon[r.act.type] ?? <StickyNote className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-zinc-400">
                      {isAI ? "Agente IA" : r.act.actorType === "system" ? "Sistema" : r.actorName} · {relTime(r.act.createdAt)}
                    </div>
                    {(r.act.payload as { text?: string }).text && (
                      <div className="text-[13px] text-zinc-700 mt-0.5 line-clamp-2">{(r.act.payload as { text?: string }).text}</div>
                    )}
                    {(r.act.payload as { to?: string }).to && (
                      <div className="text-[13px] text-zinc-700 mt-0.5">Movido para {(r.act.payload as { to?: string }).to}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <div className="font-semibold text-sm text-zinc-800 mb-4 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-zinc-400" />
          Próximos fechamentos esperados
        </div>
        <div className="grid gap-2">
          {open
            .sort((a, b) => new Date(a.opp.expectedCloseDate ?? 0).getTime() - new Date(b.opp.expectedCloseDate ?? 0).getTime())
            .slice(0, 5)
            .map((o) => (
              <Link key={o.opp.id} href={`/oportunidades/${o.opp.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 hover:border-amber-200 hover:bg-amber-50/40 transition-colors">
                <div className="text-[13px] font-medium text-zinc-800">{o.companyName ?? o.opp.name}</div>
                <div className="flex items-center gap-5 text-xs text-zinc-500">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium">{o.stageName}</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">{brl(o.opp.amount)}</span>
                  <span className="tabular-nums">{dateBR(o.opp.expectedCloseDate)}</span>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

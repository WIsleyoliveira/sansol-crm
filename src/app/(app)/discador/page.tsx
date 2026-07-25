import { redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { CheckCircle2, Clock, Phone, PhoneCall, PhoneMissed, PhoneOff, Voicemail, XCircle } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { daysSince, relTime } from "@/lib/format";
import { registerCallOutcome, type CallOutcome } from "@/app/actions-sales";

// Discador: fila linear de ligações. Quem nunca foi ligado entra na frente;
// quem não atendeu volta para o fim. O vendedor só precisa apertar "Ligar".
export default async function DiscadorPage() {
  const user = await requireUser();
  if (!can(user.role, "view_pipeline")) redirect("/projetos");

  const opps = await db.select({
    opp: s.opportunities,
    stageName: s.pipelineStages.name,
    stageOrder: s.pipelineStages.order,
    contactName: s.contacts.name,
    contactPhone: s.contacts.phone,
    city: s.sites.city,
    consumption: s.sites.avgMonthlyConsumptionKwh,
  }).from(s.opportunities)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.opportunities.stageId))
    .leftJoin(s.contacts, eq(s.contacts.id, s.opportunities.primaryContactId))
    .leftJoin(s.sites, eq(s.sites.companyId, s.opportunities.companyId))
    .where(and(eq(s.opportunities.workspaceId, user.workspaceId), eq(s.opportunities.status, "open")))
    .orderBy(asc(s.opportunities.createdAt));

  const calls = await db.select().from(s.activities)
    .where(and(eq(s.activities.workspaceId, user.workspaceId), eq(s.activities.type, "call_logged")));
  const lastCall = new Map<string, Date>();
  let callsToday = 0;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  for (const c of calls) {
    if (c.relatedToType !== "opportunity") continue;
    const prev = lastCall.get(c.relatedToId);
    if (!prev || c.createdAt > prev) lastCall.set(c.relatedToId, c.createdAt);
    if (c.createdAt >= todayStart) callsToday++;
  }

  // Fila: nunca ligados primeiro (lead mais antigo na frente); depois, quem
  // está há mais tempo sem receber ligação.
  const seen = new Set<string>();
  const queue = opps
    .filter((o) => {
      if (!o.contactPhone || seen.has(o.opp.id)) return false;
      seen.add(o.opp.id);
      return true;
    })
    .sort((a, b) => {
      const la = lastCall.get(a.opp.id)?.getTime() ?? 0;
      const lb = lastCall.get(b.opp.id)?.getTime() ?? 0;
      return la - lb;
    });

  const next = queue[0];
  const rest = queue.slice(1);
  const card = "rounded-2xl bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.12)]";

  async function outcomeAction(opportunityId: string, outcome: CallOutcome, formData: FormData) {
    "use server";
    await registerCallOutcome(opportunityId, outcome, String(formData.get("note") ?? ""));
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Discador</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Uma ligação por vez — ligue, registre o resultado e o próximo cliente aparece sozinho.</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Na fila</div>
            <div className="text-lg font-bold text-zinc-900 tabular-nums">{queue.length}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Ligações hoje</div>
            <div className="text-lg font-bold text-emerald-700 tabular-nums">{callsToday}</div>
          </div>
        </div>
      </div>

      {!next && (
        <div className={`${card} p-10 text-center`}>
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
          <div className="font-semibold text-zinc-800">Fila vazia</div>
          <p className="text-sm text-zinc-500 mt-1">Nenhuma oportunidade aberta com telefone cadastrado. Crie uma nova oportunidade para alimentar o discador.</p>
        </div>
      )}

      {next && (
        <div className={`${card} p-6`}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-1.5">
            <PhoneCall className="h-3.5 w-3.5" /> Próxima ligação
          </div>
          <div className="flex items-start justify-between gap-6">
            <div>
              <Link href={`/oportunidades/${next.opp.id}`} className="text-xl font-bold text-zinc-900 hover:text-amber-700 transition-colors">
                {next.contactName ?? next.opp.name}
              </Link>
              <div className="text-sm text-zinc-500 mt-1">
                {next.stageName} · há {daysSince(next.opp.stageEnteredAt)} dias na etapa
                {next.opp.leadSource ? ` · veio de: ${next.opp.leadSource}` : ""}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {next.city ? `${next.city} · ` : ""}
                {next.consumption ? `consumo ${next.consumption.toLocaleString("pt-BR")} kWh/mês · ` : ""}
                {lastCall.has(next.opp.id) ? `última ligação ${relTime(lastCall.get(next.opp.id)!)}` : "nunca recebeu ligação"}
              </div>
            </div>
            <a href={`tel:${next.contactPhone!.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-bold px-5 py-3 hover:bg-emerald-500 shadow-sm transition-colors shrink-0">
              <Phone className="h-4 w-4" /> Ligar {next.contactPhone}
            </a>
          </div>

          <div className="mt-5 border-t border-zinc-100 pt-4">
            <div className="text-xs font-semibold text-zinc-500 mb-2">Como foi a ligação?</div>
            <form className="space-y-3">
              <input name="note" placeholder="Observação rápida (opcional)…"
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button formAction={outcomeAction.bind(null, next.opp.id, "answered")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-2.5 hover:bg-emerald-100 transition-colors">
                  <PhoneCall className="h-3.5 w-3.5" /> Atendeu
                </button>
                <button formAction={outcomeAction.bind(null, next.opp.id, "no_answer")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-semibold px-3 py-2.5 hover:bg-zinc-200 transition-colors">
                  <PhoneMissed className="h-3.5 w-3.5" /> Não atendeu
                </button>
                <button formAction={outcomeAction.bind(null, next.opp.id, "voicemail")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-semibold px-3 py-2.5 hover:bg-zinc-200 transition-colors">
                  <Voicemail className="h-3.5 w-3.5" /> Caixa postal
                </button>
                <button formAction={outcomeAction.bind(null, next.opp.id, "not_interested")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-semibold px-3 py-2.5 hover:bg-red-100 transition-colors">
                  <XCircle className="h-3.5 w-3.5" /> Sem interesse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className={card}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2 font-semibold text-sm text-zinc-800">
            <Clock className="h-4 w-4 text-zinc-400" /> Depois dessa ({rest.length})
          </div>
          <div className="divide-y divide-zinc-50">
            {rest.map((o, i) => (
              <div key={o.opp.id} className="px-5 py-3 flex items-center gap-4">
                <span className="h-6 w-6 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 2}</span>
                <div className="flex-1 min-w-0">
                  <Link href={`/oportunidades/${o.opp.id}`} className="text-[13px] font-medium text-zinc-800 hover:text-amber-700 transition-colors">
                    {o.contactName ?? o.opp.name}
                  </Link>
                  <div className="text-xs text-zinc-400">
                    {o.stageName} · {lastCall.has(o.opp.id) ? `última ligação ${relTime(lastCall.get(o.opp.id)!)}` : "nunca ligado"}
                  </div>
                </div>
                <span className="text-xs text-zinc-500 tabular-nums shrink-0">{o.contactPhone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {opps.some((o) => !o.contactPhone) && (
        <p className="text-xs text-zinc-400 flex items-center gap-1.5">
          <PhoneOff className="h-3.5 w-3.5" />
          {opps.filter((o) => !o.contactPhone).length} oportunidade(s) fora da fila por não terem telefone cadastrado.
        </p>
      )}
    </div>
  );
}

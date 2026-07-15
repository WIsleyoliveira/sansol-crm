import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  Check, FileText, Home, Phone, Plus, Settings2, Sparkles, StickyNote, Target, User, Wrench, X, Zap,
} from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { addNote } from "@/app/actions";
import { createProposal } from "@/app/actions-create";
import { aiGenerateProposal } from "@/app/actions-ai";
import { AiButton } from "@/components/AiButton";
import { brl, dateBR, daysSince, kwp, relTime } from "@/lib/format";

export default async function OportunidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [row] = await db.select({
    opp: s.opportunities,
    stageName: s.pipelineStages.name,
    companyName: s.companies.name,
    companyIndustry: s.companies.industry,
    contactName: s.contacts.name,
    contactPhone: s.contacts.phone,
    contactEmail: s.contacts.email,
    ownerName: s.users.name,
  }).from(s.opportunities)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.opportunities.stageId))
    .leftJoin(s.companies, eq(s.companies.id, s.opportunities.companyId))
    .leftJoin(s.contacts, eq(s.contacts.id, s.opportunities.primaryContactId))
    .leftJoin(s.users, eq(s.users.id, s.opportunities.ownerId))
    .where(and(eq(s.opportunities.id, id), eq(s.opportunities.workspaceId, user.workspaceId)));

  if (!row) notFound();
  const { opp } = row;

  const [acts, props, site, survey, [project]] = await Promise.all([
    db.select({ act: s.activities, actorName: s.users.name }).from(s.activities)
      .leftJoin(s.users, eq(s.users.id, s.activities.actorId))
      .where(and(eq(s.activities.relatedToType, "opportunity"), eq(s.activities.relatedToId, id)))
      .orderBy(desc(s.activities.createdAt)),
    db.select().from(s.proposals).where(eq(s.proposals.opportunityId, id)).orderBy(asc(s.proposals.version)),
    opp.companyId
      ? db.select().from(s.sites).where(eq(s.sites.companyId, opp.companyId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select().from(s.siteSurveys).where(eq(s.siteSurveys.opportunityId, id)).then((r) => r[0] ?? null),
    db.select().from(s.installationProjects).where(eq(s.installationProjects.opportunityId, id)),
  ]);

  const showFinancials = can(user.role, "view_financials");

  async function addNoteAction(formData: FormData) {
    "use server";
    await addNote(id, String(formData.get("text") ?? ""));
  }

  async function aiProposalAction() {
    "use server";
    return aiGenerateProposal(id);
  }

  const statusBadge = opp.status === "won"
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1"><Check className="h-3 w-3" strokeWidth={3} />Ganho</span>
    : opp.status === "lost"
    ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold px-3 py-1"><X className="h-3 w-3" strokeWidth={3} />Perdido</span>
    : <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1">{row.stageName}</span>;

  const actIcon: Record<string, React.ReactNode> = {
    note: <StickyNote className="h-3.5 w-3.5" />,
    call_logged: <Phone className="h-3.5 w-3.5" />,
    stage_changed: <Target className="h-3.5 w-3.5" />,
    ai_suggestion: <Sparkles className="h-3.5 w-3.5" />,
    project_created: <Settings2 className="h-3.5 w-3.5" />,
    installation_stage_changed: <Wrench className="h-3.5 w-3.5" />,
  };

  const feasLabel: Record<string, string> = {
    pending: "Pendente", viable: "Viável", not_viable: "Inviável", needs_reinforcement: "Requer reforço estrutural",
  };

  const card = "rounded-2xl bg-white border border-zinc-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
  const cardHeader = "px-5 py-4 border-b border-zinc-100 flex items-center gap-2 font-semibold text-sm text-zinc-800";

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-7 gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{opp.name}</h1>
            {statusBadge}
          </div>
          <p className="text-sm text-zinc-500 mt-1.5">
            {row.companyName} {row.companyIndustry ? `· ${row.companyIndustry}` : ""} · Responsável: {row.ownerName}
            {opp.leadSource ? ` · Origem: ${opp.leadSource}` : ""}
          </p>
          {opp.status === "lost" && opp.lostReason && (
            <p className="text-sm text-red-600 mt-1">Motivo da perda: {opp.lostReason}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {showFinancials && <div className="text-[26px] font-bold text-emerald-700 tabular-nums tracking-tight">{brl(opp.amount)}</div>}
          <div className="text-sm text-zinc-500 flex items-center justify-end gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            {kwp(opp.systemSizeKwp)}{showFinancials && opp.expectedCloseDate ? ` · fecha ${dateBR(opp.expectedCloseDate)}` : ""}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className={card}>
            <div className={cardHeader}>Timeline</div>
            <form action={addNoteAction} className="px-5 py-4 border-b border-zinc-100 flex gap-2">
              <input name="text" placeholder="Adicionar nota…" required
                className="flex-1 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
              <button className="rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-5 hover:bg-zinc-700 transition-colors">Salvar</button>
            </form>
            <div className="divide-y divide-zinc-50">
              {acts.map((a) => {
                const payload = a.act.payload as { text?: string; to?: string };
                const isAI = a.act.actorType === "ai_agent";
                return (
                  <div key={a.act.id} className={`px-5 py-4 flex gap-3.5 ${isAI ? "bg-violet-50/40" : ""}`}>
                    <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${isAI ? "bg-violet-100 text-violet-600" : "bg-zinc-100 text-zinc-500"}`}>
                      {actIcon[a.act.type] ?? <StickyNote className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-zinc-400">
                        {isAI ? "Agente IA" : a.act.actorType === "system" ? "Sistema" : a.actorName} · {relTime(a.act.createdAt)}
                      </div>
                      <div className="text-[13px] text-zinc-700 mt-0.5 leading-relaxed">
                        {payload.text ?? (payload.to ? `Movido para "${payload.to}"` : a.act.type)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className={`${card} p-5`}>
            <div className="font-semibold text-sm text-zinc-800 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-400" /> Contato principal
            </div>
            <div className="text-sm font-medium text-zinc-900">{row.contactName ?? "—"}</div>
            <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">{row.contactPhone}</div>
            <div className="text-xs text-zinc-500">{row.contactEmail}</div>
          </div>

          {site && (
            <div className={`${card} p-5`}>
              <div className="font-semibold text-sm text-zinc-800 mb-3 flex items-center gap-2">
                <Home className="h-4 w-4 text-zinc-400" /> Local da instalação
              </div>
              <div className="text-sm text-zinc-800">{site.address}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{site.city}/{site.state} · {site.utilityCompany} · classe {site.tariffClass}</div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                <div className="rounded-xl bg-zinc-50 p-3">
                  <div className="text-zinc-400 mb-0.5">Telhado</div>
                  <div className="text-zinc-800 font-semibold">{site.roofType ?? "—"}{site.roofAreaM2 ? ` · ${site.roofAreaM2} m²` : ""}</div>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <div className="text-zinc-400 mb-0.5">Consumo médio</div>
                  <div className="text-zinc-800 font-semibold tabular-nums">{site.avgMonthlyConsumptionKwh?.toLocaleString("pt-BR") ?? "—"} kWh/mês</div>
                </div>
              </div>
              {survey && (
                <div className="mt-3 rounded-xl border border-zinc-100 p-3 text-xs">
                  <div className="text-zinc-400 mb-0.5">
                    Visita técnica — {survey.completedAt ? `concluída ${dateBR(survey.completedAt)}` : `agendada ${dateBR(survey.scheduledAt)}`}
                  </div>
                  <div className="font-semibold text-zinc-800">{feasLabel[survey.technicalFeasibility]}</div>
                  {survey.structuralNotes && <div className="text-zinc-600 mt-1 leading-relaxed">{survey.structuralNotes}</div>}
                </div>
              )}
            </div>
          )}

          {showFinancials && (
            <div className={`${card} p-5`}>
              <div className="font-semibold text-sm text-zinc-800 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-400" /> Propostas
              </div>
              {props.length === 0 && <p className="text-xs text-zinc-400 mb-3">Nenhuma proposta ainda.</p>}
              {props.map((p) => (
                <div key={p.id} className="rounded-xl border border-zinc-100 p-3.5 text-xs space-y-1.5 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-800">v{p.version} · {kwp(p.systemSizeKwp)}</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${
                      p.status === "accepted" ? "bg-emerald-50 text-emerald-600"
                      : p.status === "rejected" ? "bg-red-50 text-red-600"
                      : p.status === "sent" ? "bg-amber-50 text-amber-600"
                      : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {p.status === "accepted" ? "Aceita" : p.status === "rejected" ? "Recusada" : p.status === "sent" ? "Enviada" : "Rascunho"}
                    </span>
                  </div>
                  <div className="text-zinc-500">{p.panelQty}× {p.panelModel}</div>
                  <div className="text-zinc-500">Inversor: {p.inverterModel}</div>
                  <div className="text-zinc-500">
                    Geração est.: {p.estimatedGenerationKwhMonth?.toLocaleString("pt-BR")} kWh/mês · payback {p.paybackYears} anos
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-zinc-100">
                    <span className="text-zinc-500">{p.financingType === "financing" ? `Financiado ${p.installments}×` : "À vista"}</span>
                    <span className="font-bold text-zinc-900 tabular-nums">{brl(p.totalPrice)}</span>
                  </div>
                </div>
              ))}

              {opp.status === "open" && (
                <div className="mt-4 space-y-3">
                  <AiButton
                    action={aiProposalAction}
                    label="Gerar proposta com IA"
                    busyLabel="Dimensionando sistema…"
                  />
                  <details className="rounded-xl border border-zinc-100">
                    <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 flex items-center gap-1.5 rounded-xl">
                      <Plus className="h-3.5 w-3.5" /> Nova proposta manual
                    </summary>
                    <form action={createProposal} className="p-3.5 pt-1 space-y-2 text-xs">
                      <input type="hidden" name="opportunityId" value={id} />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="systemSizeKwp" required placeholder="kWp *" type="number" step="0.01" min="0"
                          className="rounded-lg border border-zinc-200 px-2.5 py-2" />
                        <input name="totalPrice" required placeholder="Preço total R$ *" type="number" step="0.01" min="0"
                          className="rounded-lg border border-zinc-200 px-2.5 py-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input name="panelModel" placeholder="Modelo do painel" className="rounded-lg border border-zinc-200 px-2.5 py-2" />
                        <input name="panelQty" placeholder="Qtd. painéis" type="number" min="0" className="rounded-lg border border-zinc-200 px-2.5 py-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input name="inverterModel" placeholder="Inversor" className="rounded-lg border border-zinc-200 px-2.5 py-2" />
                        <input name="paybackYears" placeholder="Payback (anos)" type="number" step="0.1" min="0" className="rounded-lg border border-zinc-200 px-2.5 py-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select name="financingType" className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2">
                          <option value="cash">À vista</option>
                          <option value="financing">Financiamento</option>
                          <option value="leasing">Leasing</option>
                        </select>
                        <input name="installments" placeholder="Parcelas" type="number" min="1" className="rounded-lg border border-zinc-200 px-2.5 py-2" />
                      </div>
                      <button className="w-full rounded-lg bg-zinc-900 text-white font-semibold py-2 hover:bg-zinc-700 transition-colors">
                        Criar proposta
                      </button>
                    </form>
                  </details>
                </div>
              )}
            </div>
          )}

          {project && (
            <div className={`${card} p-5`}>
              <div className="font-semibold text-sm text-zinc-800 mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-zinc-400" /> Projeto de instalação
              </div>
              <div className="text-xs space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Projeto/ART</span>
                  <span className="font-semibold text-zinc-800">
                    {project.permitStatus === "approved" ? "Aprovado" : project.permitStatus === "submitted" ? "Protocolado" : "Pendente"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Concessionária</span>
                  <span className="font-semibold text-zinc-800">
                    {project.utilityApprovalStatus === "approved" ? "Homologado" : project.utilityApprovalStatus === "submitted" ? "Em análise" : "Pendente"}
                  </span>
                </div>
                {project.installationScheduledAt && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Instalação</span>
                    <span className="font-semibold text-zinc-800 tabular-nums">{dateBR(project.installationScheduledAt)}</span>
                  </div>
                )}
                {project.warrantyStartDate && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Garantia desde</span>
                    <span className="font-semibold text-zinc-800 tabular-nums">{dateBR(project.warrantyStartDate)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-400">Na etapa atual há</span>
                  <span className="font-semibold text-zinc-800">{daysSince(project.stageEnteredAt)} dias</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

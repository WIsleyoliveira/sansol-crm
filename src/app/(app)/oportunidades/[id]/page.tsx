import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
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

  const statusBadge = opp.status === "won"
    ? <span className="rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1">Ganho ✓</span>
    : opp.status === "lost"
    ? <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1">Perdido</span>
    : <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1">{row.stageName}</span>;

  const typeLabel: Record<string, string> = {
    note: "📝", call_logged: "📞", stage_changed: "🎯", ai_suggestion: "🤖",
    project_created: "⚙️", installation_stage_changed: "🔧",
  };

  const feasLabel: Record<string, string> = {
    pending: "Pendente", viable: "Viável ✓", not_viable: "Inviável", needs_reinforcement: "Requer reforço estrutural",
  };

  const showFinancials = can(user.role, "view_financials");

  async function addNoteAction(formData: FormData) {
    "use server";
    await addNote(id, String(formData.get("text") ?? ""));
  }

  async function aiProposalAction() {
    "use server";
    return aiGenerateProposal(id);
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-900">{opp.name}</h1>
            {statusBadge}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {row.companyName} {row.companyIndustry ? `· ${row.companyIndustry}` : ""} · Responsável: {row.ownerName}
            {opp.leadSource ? ` · Origem: ${opp.leadSource}` : ""}
          </p>
          {opp.status === "lost" && opp.lostReason && (
            <p className="text-sm text-red-600 mt-1">Motivo da perda: {opp.lostReason}</p>
          )}
        </div>
        <div className="text-right">
          {showFinancials && <div className="text-2xl font-bold text-emerald-700">{brl(opp.amount)}</div>}
          <div className="text-sm text-zinc-500">{kwp(opp.systemSizeKwp)}{showFinancials ? ` · fecha ${dateBR(opp.expectedCloseDate)}` : ""}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-white border border-zinc-200">
            <div className="px-4 py-3 border-b border-zinc-100 font-semibold text-sm text-zinc-700">Timeline</div>
            <form action={addNoteAction} className="px-4 py-3 border-b border-zinc-100 flex gap-2">
              <input name="text" placeholder="Adicionar nota…" required
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
              <button className="rounded-lg bg-zinc-900 text-white text-sm px-4 py-2 hover:bg-zinc-700">Salvar</button>
            </form>
            <div className="divide-y divide-zinc-100">
              {acts.map((a) => {
                const payload = a.act.payload as { text?: string; to?: string };
                const isAI = a.act.actorType === "ai_agent";
                return (
                  <div key={a.act.id} className={`px-4 py-3 ${isAI ? "bg-violet-50/50" : ""}`}>
                    <div className="text-xs text-zinc-400">
                      {typeLabel[a.act.type] ?? "•"} {isAI ? "Agente IA" : a.act.actorType === "system" ? "Sistema" : a.actorName} · {relTime(a.act.createdAt)}
                    </div>
                    <div className="text-sm text-zinc-800 mt-0.5">
                      {payload.text ?? (payload.to ? `Movido para "${payload.to}"` : a.act.type)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar: contato, site, propostas, instalação */}
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-zinc-200 p-4">
            <div className="font-semibold text-sm text-zinc-700 mb-2">Contato principal</div>
            <div className="text-sm text-zinc-900">{row.contactName ?? "—"}</div>
            <div className="text-xs text-zinc-500">{row.contactPhone}</div>
            <div className="text-xs text-zinc-500">{row.contactEmail}</div>
          </div>

          {site && (
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
              <div className="font-semibold text-sm text-zinc-700 mb-2">🏠 Local da instalação</div>
              <div className="text-sm text-zinc-800">{site.address}</div>
              <div className="text-xs text-zinc-500">{site.city}/{site.state} · {site.utilityCompany} · classe {site.tariffClass}</div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="rounded bg-zinc-50 p-2">
                  <div className="text-zinc-400">Telhado</div>
                  <div className="text-zinc-800 font-medium">{site.roofType} · {site.roofAreaM2} m²</div>
                </div>
                <div className="rounded bg-zinc-50 p-2">
                  <div className="text-zinc-400">Consumo médio</div>
                  <div className="text-zinc-800 font-medium">{site.avgMonthlyConsumptionKwh?.toLocaleString("pt-BR")} kWh/mês</div>
                </div>
              </div>
              {survey && (
                <div className="mt-3 rounded-lg border border-zinc-100 p-2.5 text-xs">
                  <div className="text-zinc-400 mb-0.5">Visita técnica — {survey.completedAt ? `concluída ${dateBR(survey.completedAt)}` : `agendada ${dateBR(survey.scheduledAt)}`}</div>
                  <div className="font-medium text-zinc-800">{feasLabel[survey.technicalFeasibility]}</div>
                  {survey.structuralNotes && <div className="text-zinc-600 mt-1">{survey.structuralNotes}</div>}
                </div>
              )}
            </div>
          )}

          {showFinancials && (
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
              <div className="font-semibold text-sm text-zinc-700 mb-2">📄 Propostas</div>
              {props.length === 0 && <p className="text-xs text-zinc-400 mb-3">Nenhuma proposta ainda.</p>}
              {props.map((p) => (
                <div key={p.id} className="rounded-lg border border-zinc-100 p-3 text-xs space-y-1 mb-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-zinc-800">v{p.version} · {kwp(p.systemSizeKwp)}</span>
                    <span className={`font-semibold ${p.status === "accepted" ? "text-emerald-600" : p.status === "rejected" ? "text-red-600" : "text-amber-600"}`}>
                      {p.status === "accepted" ? "Aceita" : p.status === "rejected" ? "Recusada" : p.status === "sent" ? "Enviada" : "Rascunho"}
                    </span>
                  </div>
                  <div className="text-zinc-500">{p.panelQty}× {p.panelModel}</div>
                  <div className="text-zinc-500">Inversor: {p.inverterModel}</div>
                  <div className="text-zinc-500">Geração est.: {p.estimatedGenerationKwhMonth?.toLocaleString("pt-BR")} kWh/mês · payback {p.paybackYears} anos</div>
                  <div className="flex justify-between pt-1 border-t border-zinc-100">
                    <span className="text-zinc-500">{p.financingType === "financing" ? `Financiado ${p.installments}×` : "À vista"}</span>
                    <span className="font-bold text-zinc-900">{brl(p.totalPrice)}</span>
                  </div>
                </div>
              ))}

              {opp.status === "open" && (
                <div className="mt-3 space-y-3">
                  <AiButton
                    action={aiProposalAction}
                    label="Gerar proposta com IA"
                    busyLabel="Dimensionando sistema…"
                  />
                  <details className="rounded-lg border border-zinc-100">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                      + Nova proposta manual
                    </summary>
                    <form action={createProposal} className="p-3 space-y-2 text-xs">
                      <input type="hidden" name="opportunityId" value={id} />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="systemSizeKwp" required placeholder="kWp *" type="number" step="0.01" min="0"
                          className="rounded border border-zinc-200 px-2 py-1.5" />
                        <input name="totalPrice" required placeholder="Preço total R$ *" type="number" step="0.01" min="0"
                          className="rounded border border-zinc-200 px-2 py-1.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input name="panelModel" placeholder="Modelo do painel" className="rounded border border-zinc-200 px-2 py-1.5" />
                        <input name="panelQty" placeholder="Qtd. painéis" type="number" min="0" className="rounded border border-zinc-200 px-2 py-1.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input name="inverterModel" placeholder="Inversor" className="rounded border border-zinc-200 px-2 py-1.5" />
                        <input name="paybackYears" placeholder="Payback (anos)" type="number" step="0.1" min="0" className="rounded border border-zinc-200 px-2 py-1.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select name="financingType" className="rounded border border-zinc-200 bg-white px-2 py-1.5">
                          <option value="cash">À vista</option>
                          <option value="financing">Financiamento</option>
                          <option value="leasing">Leasing</option>
                        </select>
                        <input name="installments" placeholder="Parcelas" type="number" min="1" className="rounded border border-zinc-200 px-2 py-1.5" />
                      </div>
                      <button className="w-full rounded bg-zinc-900 text-white py-1.5 hover:bg-zinc-700">Criar proposta</button>
                    </form>
                  </details>
                </div>
              )}
            </div>
          )}

          {project && (
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
              <div className="font-semibold text-sm text-zinc-700 mb-2">🔧 Projeto de instalação</div>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-zinc-400">Projeto/ART</span>
                  <span className="font-medium">{project.permitStatus === "approved" ? "Aprovado ✓" : project.permitStatus === "submitted" ? "Protocolado" : "Pendente"}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Concessionária</span>
                  <span className="font-medium">{project.utilityApprovalStatus === "approved" ? "Homologado ✓" : project.utilityApprovalStatus === "submitted" ? "Em análise" : "Pendente"}</span></div>
                {project.installationScheduledAt && (
                  <div className="flex justify-between"><span className="text-zinc-400">Instalação</span>
                    <span className="font-medium">{dateBR(project.installationScheduledAt)}</span></div>
                )}
                {project.warrantyStartDate && (
                  <div className="flex justify-between"><span className="text-zinc-400">Garantia desde</span>
                    <span className="font-medium">{dateBR(project.warrantyStartDate)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-zinc-400">Na etapa atual há</span>
                  <span className="font-medium">{daysSince(project.stageEnteredAt)} dias</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

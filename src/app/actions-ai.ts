"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { aiAvailable, suggestNextActions, suggestSizing } from "@/lib/ai";
import { daysSince } from "@/lib/format";

export type AiResult = { ok: boolean; message: string };

// Agente de dimensionamento: gera proposta rascunho a partir do consumo do site.
export async function aiGenerateProposal(opportunityId: string): Promise<AiResult> {
  const user = await requireUser();
  if (!can(user.role, "use_ai")) return { ok: false, message: "Sem permissão para usar agentes de IA." };
  if (!aiAvailable()) {
    return { ok: false, message: "Configure ANTHROPIC_API_KEY em .env.local para ativar os agentes de IA." };
  }

  const [opp] = await db.select().from(s.opportunities)
    .where(and(eq(s.opportunities.id, opportunityId), eq(s.opportunities.workspaceId, user.workspaceId)));
  if (!opp?.companyId) return { ok: false, message: "Oportunidade sem empresa vinculada." };

  const [company] = await db.select().from(s.companies).where(eq(s.companies.id, opp.companyId));
  const [site] = await db.select().from(s.sites).where(eq(s.sites.companyId, opp.companyId));
  if (!site?.avgMonthlyConsumptionKwh) {
    return { ok: false, message: "Cadastre o consumo médio (kWh/mês) do local antes de dimensionar." };
  }

  const catalog = await db.select().from(s.equipmentCatalog)
    .where(eq(s.equipmentCatalog.workspaceId, user.workspaceId));

  try {
    const sug = await suggestSizing({
      companyName: company.name,
      avgMonthlyConsumptionKwh: site.avgMonthlyConsumptionKwh,
      roofType: site.roofType,
      roofAreaM2: site.roofAreaM2,
      city: site.city,
      state: site.state,
      catalog: catalog.map((c) => ({
        type: c.type, manufacturer: c.manufacturer, model: c.model,
        specs: c.specs, unitPrice: c.unitPrice,
      })),
    });

    const [last] = await db.select().from(s.proposals)
      .where(eq(s.proposals.opportunityId, opportunityId))
      .orderBy(desc(s.proposals.version)).limit(1);

    await db.insert(s.proposals).values({
      workspaceId: user.workspaceId,
      opportunityId,
      version: (last?.version ?? 0) + 1,
      systemSizeKwp: String(sug.system_size_kwp),
      panelModel: sug.panel_model,
      panelQty: sug.panel_qty,
      inverterModel: sug.inverter_model,
      estimatedGenerationKwhMonth: sug.estimated_generation_kwh_month,
      paybackYears: String(sug.payback_years),
      totalPrice: String(sug.estimated_price_brl),
      financingType: "cash",
      status: "draft",
    });

    await db.insert(s.activities).values({
      workspaceId: user.workspaceId, actorId: null, actorType: "ai_agent",
      relatedToType: "opportunity", relatedToId: opportunityId,
      type: "ai_suggestion",
      payload: { text: `Proposta v${(last?.version ?? 0) + 1} gerada: ${sug.system_size_kwp} kWp, ${sug.panel_qty}× ${sug.panel_model}. ${sug.rationale}` },
    });

    revalidatePath(`/oportunidades/${opportunityId}`);
    return { ok: true, message: `Proposta rascunho de ${sug.system_size_kwp} kWp criada pelo agente de IA.` };
  } catch (e) {
    return { ok: false, message: `Falha no agente de IA: ${e instanceof Error ? e.message : "erro desconhecido"}` };
  }
}

// Agente de next-best-action: analisa oportunidades paradas e cria tarefas.
export async function aiAnalyzePipeline(): Promise<AiResult> {
  const user = await requireUser();
  if (!can(user.role, "use_ai")) return { ok: false, message: "Sem permissão para usar agentes de IA." };
  if (!aiAvailable()) {
    return { ok: false, message: "Configure ANTHROPIC_API_KEY em .env.local para ativar os agentes de IA." };
  }

  const opps = await db.select({
    opp: s.opportunities,
    stageName: s.pipelineStages.name,
    companyName: s.companies.name,
  }).from(s.opportunities)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.opportunities.stageId))
    .leftJoin(s.companies, eq(s.companies.id, s.opportunities.companyId))
    .where(and(eq(s.opportunities.workspaceId, user.workspaceId), eq(s.opportunities.status, "open"), ne(s.pipelineStages.isLost, true)));

  const stalled = opps.filter((o) => daysSince(o.opp.stageEnteredAt) > 7);
  if (stalled.length === 0) return { ok: true, message: "Nenhuma oportunidade parada há mais de 7 dias. Funil saudável 🎉" };

  const withActs = await Promise.all(stalled.map(async (o) => {
    const acts = await db.select().from(s.activities)
      .where(and(eq(s.activities.relatedToType, "opportunity"), eq(s.activities.relatedToId, o.opp.id)))
      .orderBy(desc(s.activities.createdAt)).limit(3);
    return {
      id: o.opp.id,
      name: `${o.companyName ?? o.opp.name}`,
      stage: o.stageName,
      amount: o.opp.amount,
      daysInStage: daysSince(o.opp.stageEnteredAt),
      lastActivities: acts.map((a) => `${a.type}: ${(a.payload as { text?: string }).text ?? ""}`),
    };
  }));

  try {
    const suggestions = await suggestNextActions({ opportunities: withActs });
    let created = 0;

    for (const sug of suggestions) {
      const opp = stalled.find((o) => o.opp.id === sug.opportunity_id);
      if (!opp) continue;
      await db.insert(s.tasks).values({
        workspaceId: user.workspaceId,
        relatedToType: "opportunity",
        relatedToId: opp.opp.id,
        assigneeId: opp.opp.ownerId,
        createdByAgent: true,
        type: sug.task_type,
        title: `[IA] ${sug.task_title}`,
        dueAt: new Date(Date.now() + 86400000),
      });
      await db.insert(s.activities).values({
        workspaceId: user.workspaceId, actorId: null, actorType: "ai_agent",
        relatedToType: "opportunity", relatedToId: opp.opp.id,
        type: "ai_suggestion",
        payload: { text: `Próxima ação sugerida: ${sug.task_title}. Motivo: ${sug.reasoning}` },
      });
      created++;
    }

    revalidatePath("/");
    revalidatePath("/tarefas");
    return { ok: true, message: `${created} tarefa(s) criadas pelo agente de IA para negócios parados.` };
  } catch (e) {
    return { ok: false, message: `Falha no agente de IA: ${e instanceof Error ? e.message : "erro desconhecido"}` };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { moveOpportunityStage } from "@/app/actions";

// ─── Discador ────────────────────────────────────────────────────────────────

export type CallOutcome = "answered" | "no_answer" | "voicemail" | "not_interested";

const outcomeText: Record<CallOutcome, string> = {
  answered: "Ligação atendida — conversa registrada pelo discador.",
  no_answer: "Ligação não atendida — cliente volta para o fim da fila do discador.",
  voicemail: "Caiu na caixa postal — cliente volta para o fim da fila do discador.",
  not_interested: "Cliente sem interesse — oportunidade marcada como perdida pelo discador.",
};

export async function registerCallOutcome(opportunityId: string, outcome: CallOutcome, note?: string) {
  const user = await requireUser();

  const [opp] = await db.select().from(s.opportunities)
    .where(and(eq(s.opportunities.id, opportunityId), eq(s.opportunities.workspaceId, user.workspaceId)));
  if (!opp) return;

  const text = note?.trim() ? `${outcomeText[outcome]} Obs.: ${note.trim()}` : outcomeText[outcome];
  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "opportunity", relatedToId: opportunityId,
    type: "call_logged", payload: { text, outcome },
  });

  if (outcome === "not_interested") {
    const [lostStage] = await db.select().from(s.pipelineStages)
      .where(and(eq(s.pipelineStages.pipelineId, opp.pipelineId), eq(s.pipelineStages.isLost, true)));
    if (lostStage) {
      await moveOpportunityStage(opportunityId, lostStage.id);
      await db.update(s.opportunities).set({ lostReason: "Sem interesse (discador)" })
        .where(eq(s.opportunities.id, opportunityId));
    }
  }

  revalidatePath("/discador");
  revalidatePath(`/oportunidades/${opportunityId}`);
}

export async function setCommissionStatus(commissionId: string, status: "approved" | "paid") {
  const user = await requireUser();
  const [c] = await db.select().from(s.commissions)
    .where(and(eq(s.commissions.id, commissionId), eq(s.commissions.workspaceId, user.workspaceId)));
  if (!c) return;
  await db.update(s.commissions).set({
    status,
    approvedAt: status === "approved" ? new Date() : c.approvedAt,
    paidAt: status === "paid" ? new Date() : c.paidAt,
  }).where(eq(s.commissions.id, commissionId));
  revalidatePath("/comissoes");
}

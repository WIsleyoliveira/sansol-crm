"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { channelLabel, type PresalesChannel } from "@/lib/presalesChannels";

export async function createPresalesLead(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "manage_records")) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name || !phone) return;

  const channel = (String(formData.get("channel") ?? "outro") || "outro") as PresalesChannel;

  const [lead] = await db.insert(s.presalesLeads).values({
    workspaceId: user.workspaceId,
    name,
    phone,
    email: String(formData.get("email") ?? "").trim() || null,
    channel,
    socialNetwork: String(formData.get("socialNetwork") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    ownerId: user.id,
  }).returning();

  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "presales_lead", relatedToId: lead.id,
    type: "note", payload: { text: "Lead de pré-venda criado." },
  });

  revalidatePath("/pre-vendas");
  redirect(`/pre-vendas/${lead.id}`);
}

export async function moveLeadStatus(leadId: string, toStatus: string) {
  const user = await requireUser();

  const [lead] = await db.select().from(s.presalesLeads)
    .where(and(eq(s.presalesLeads.id, leadId), eq(s.presalesLeads.workspaceId, user.workspaceId)));
  if (!lead || lead.status === toStatus) return;

  await db.update(s.presalesLeads).set({ status: toStatus as typeof lead.status, updatedAt: new Date() })
    .where(eq(s.presalesLeads.id, leadId));

  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "presales_lead", relatedToId: leadId,
    type: "presales_status_changed", payload: { to: toStatus },
  });

  revalidatePath("/pre-vendas");
  revalidatePath(`/pre-vendas/${leadId}`);
}

export async function setLeadClassification(leadId: string, classification: "quente" | "morno" | "frio") {
  const user = await requireUser();

  const [lead] = await db.select().from(s.presalesLeads)
    .where(and(eq(s.presalesLeads.id, leadId), eq(s.presalesLeads.workspaceId, user.workspaceId)));
  if (!lead) return;

  await db.update(s.presalesLeads).set({ classification, updatedAt: new Date() })
    .where(eq(s.presalesLeads.id, leadId));

  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "presales_lead", relatedToId: leadId,
    type: "note", payload: { text: `Classificação definida: ${classification}.` },
  });

  revalidatePath(`/pre-vendas/${leadId}`);
  revalidatePath("/pre-vendas");
}

// Promove um lead de pré-venda para uma oportunidade de verdade (cria
// empresa+contato na 1ª etapa do pipeline de vendas) — mesmo espírito do
// workflow de moveOpportunityStage (etapa "ganho" cria projeto de instalação).
export async function promoteToOpportunity(leadId: string) {
  const user = await requireUser();
  if (!can(user.role, "manage_records")) throw new Error("FORBIDDEN");

  const [lead] = await db.select().from(s.presalesLeads)
    .where(and(eq(s.presalesLeads.id, leadId), eq(s.presalesLeads.workspaceId, user.workspaceId)));
  if (!lead || lead.status === "convertido") return;

  const [pipe] = await db.select().from(s.pipelines)
    .where(and(eq(s.pipelines.workspaceId, user.workspaceId), eq(s.pipelines.kind, "sales")));
  const [firstStage] = await db.select().from(s.pipelineStages)
    .where(eq(s.pipelineStages.pipelineId, pipe.id)).orderBy(asc(s.pipelineStages.order)).limit(1);

  let [company] = await db.select().from(s.companies)
    .where(and(eq(s.companies.workspaceId, user.workspaceId), eq(s.companies.name, lead.name)));
  if (!company) {
    [company] = await db.insert(s.companies).values({
      workspaceId: user.workspaceId, name: lead.name, industry: "Pessoa Física", ownerId: user.id,
    }).returning();
  }

  let [contact] = await db.select().from(s.contacts)
    .where(and(eq(s.contacts.workspaceId, user.workspaceId), eq(s.contacts.companyId, company.id)))
    .limit(1);
  if (!contact) {
    [contact] = await db.insert(s.contacts).values({
      workspaceId: user.workspaceId, companyId: company.id, name: lead.name,
      phone: lead.phone, email: lead.email, ownerId: user.id,
    }).returning();
  }

  const leadSource = `${channelLabel(lead.channel)}${lead.socialNetwork ? ` · ${lead.socialNetwork}` : ""}`;

  const [opp] = await db.insert(s.opportunities).values({
    workspaceId: user.workspaceId,
    pipelineId: pipe.id,
    stageId: firstStage.id,
    companyId: company.id,
    primaryContactId: contact.id,
    ownerId: user.id,
    name: lead.name,
    leadSource,
  }).returning();

  await db.insert(s.opportunityStageHistory).values({
    opportunityId: opp.id, fromStageId: null, toStageId: firstStage.id, changedBy: user.id,
  });
  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "opportunity", relatedToId: opp.id,
    type: "note", payload: { text: "Oportunidade criada a partir de um lead de pré-venda." },
  });

  await db.update(s.presalesLeads).set({
    status: "convertido", convertedOpportunityId: opp.id, updatedAt: new Date(),
  }).where(eq(s.presalesLeads.id, leadId));
  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "presales_lead", relatedToId: leadId,
    type: "note", payload: { text: "Lead promovido a oportunidade." },
  });

  revalidatePath("/pre-vendas");
  revalidatePath("/pipeline");
  redirect(`/oportunidades/${opp.id}`);
}

// Encontra (ou cria) a conversa de WhatsApp de um lead de pré-venda e vincula os dois.
export async function findOrCreateConversationForPresalesLead(leadId: string): Promise<string | null> {
  const user = await requireUser();

  const [lead] = await db.select().from(s.presalesLeads)
    .where(and(eq(s.presalesLeads.id, leadId), eq(s.presalesLeads.workspaceId, user.workspaceId)));
  if (!lead?.phone) return null;

  let [conv] = await db.select().from(s.whatsappConversations)
    .where(and(eq(s.whatsappConversations.workspaceId, user.workspaceId), eq(s.whatsappConversations.phone, lead.phone)));

  if (!conv) {
    [conv] = await db.insert(s.whatsappConversations).values({
      workspaceId: user.workspaceId,
      presalesLeadId: lead.id,
      phone: lead.phone,
      contactName: lead.name,
      assignedTo: user.id,
      lastMessagePreview: "Conversa iniciada a partir do lead de pré-venda.",
    }).returning();
  } else if (!conv.presalesLeadId) {
    await db.update(s.whatsappConversations).set({ presalesLeadId: lead.id }).where(eq(s.whatsappConversations.id, conv.id));
  }

  return conv.id;
}

export async function openWhatsappForPresalesLead(leadId: string) {
  const convId = await findOrCreateConversationForPresalesLead(leadId);
  redirect(convId ? `/pre-vendas?view=chat&c=${convId}` : "/pre-vendas");
}

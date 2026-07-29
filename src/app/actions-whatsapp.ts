"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { sendWhatsappMessage } from "@/lib/whatsapp";

export async function sendMessage(conversationId: string, formData: FormData) {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const [conv] = await db.select().from(s.whatsappConversations)
    .where(and(eq(s.whatsappConversations.id, conversationId), eq(s.whatsappConversations.workspaceId, user.workspaceId)));
  if (!conv) return;

  const result = await sendWhatsappMessage(conv.phone, body);

  await db.insert(s.whatsappMessages).values({
    workspaceId: user.workspaceId,
    conversationId,
    direction: "out",
    body,
    sentBy: user.id,
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
  });

  await db.update(s.whatsappConversations).set({
    lastMessageAt: new Date(),
    lastMessagePreview: body,
  }).where(eq(s.whatsappConversations.id, conversationId));

  revalidatePath("/whatsapp");
}

export async function sendTemplateMessage(conversationId: string, templateId: string) {
  const user = await requireUser();
  const [template] = await db.select().from(s.whatsappTemplates)
    .where(and(eq(s.whatsappTemplates.id, templateId), eq(s.whatsappTemplates.workspaceId, user.workspaceId)));
  if (!template) return;

  const fd = new FormData();
  fd.set("body", template.body);
  await sendMessage(conversationId, fd);
}

export async function markConversationRead(conversationId: string) {
  const user = await requireUser();
  await db.update(s.whatsappConversations)
    .set({ unreadCount: 0 })
    .where(and(eq(s.whatsappConversations.id, conversationId), eq(s.whatsappConversations.workspaceId, user.workspaceId)));
  revalidatePath("/whatsapp");
}

export async function assignConversation(conversationId: string, userId: string) {
  const user = await requireUser();
  await db.update(s.whatsappConversations)
    .set({ assignedTo: userId || null })
    .where(and(eq(s.whatsappConversations.id, conversationId), eq(s.whatsappConversations.workspaceId, user.workspaceId)));
  revalidatePath("/whatsapp");
}

export async function setConversationStatus(conversationId: string, status: "open" | "pending" | "closed") {
  const user = await requireUser();
  await db.update(s.whatsappConversations)
    .set({ status })
    .where(and(eq(s.whatsappConversations.id, conversationId), eq(s.whatsappConversations.workspaceId, user.workspaceId)));
  revalidatePath("/whatsapp");
}

export async function startConversation(formData: FormData) {
  const user = await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) return;

  const [contact] = await db.select().from(s.contacts)
    .where(and(eq(s.contacts.id, contactId), eq(s.contacts.workspaceId, user.workspaceId)));
  if (!contact?.phone) return;

  const existing = await db.select().from(s.whatsappConversations)
    .where(and(eq(s.whatsappConversations.workspaceId, user.workspaceId), eq(s.whatsappConversations.phone, contact.phone)));

  if (existing.length === 0) {
    await db.insert(s.whatsappConversations).values({
      workspaceId: user.workspaceId,
      contactId: contact.id,
      companyId: contact.companyId,
      phone: contact.phone,
      contactName: contact.name,
      assignedTo: user.id,
      lastMessagePreview: "Conversa iniciada.",
    });
  }

  revalidatePath("/whatsapp");
}

// Encontra (ou cria) a conversa do contato de uma oportunidade e vincula os dois.
export async function findOrCreateConversationForOpportunity(opportunityId: string): Promise<string | null> {
  const user = await requireUser();

  const [opp] = await db.select().from(s.opportunities)
    .where(and(eq(s.opportunities.id, opportunityId), eq(s.opportunities.workspaceId, user.workspaceId)));
  if (!opp?.primaryContactId) return null;

  const [contact] = await db.select().from(s.contacts).where(eq(s.contacts.id, opp.primaryContactId));
  if (!contact?.phone) return null;

  let [conv] = await db.select().from(s.whatsappConversations)
    .where(and(eq(s.whatsappConversations.workspaceId, user.workspaceId), eq(s.whatsappConversations.phone, contact.phone)));

  if (!conv) {
    [conv] = await db.insert(s.whatsappConversations).values({
      workspaceId: user.workspaceId,
      contactId: contact.id,
      companyId: contact.companyId,
      opportunityId: opp.id,
      phone: contact.phone,
      contactName: contact.name,
      assignedTo: user.id,
      lastMessagePreview: "Conversa iniciada a partir da oportunidade.",
    }).returning();
  } else if (!conv.opportunityId) {
    await db.update(s.whatsappConversations).set({ opportunityId: opp.id }).where(eq(s.whatsappConversations.id, conv.id));
  }

  return conv.id;
}

export async function openWhatsappForOpportunity(opportunityId: string) {
  const convId = await findOrCreateConversationForOpportunity(opportunityId);
  redirect(convId ? `/whatsapp?c=${convId}` : "/whatsapp");
}

export async function listConversationMessages(conversationId: string) {
  const user = await requireUser();
  return db.select().from(s.whatsappMessages)
    .where(and(eq(s.whatsappMessages.conversationId, conversationId), eq(s.whatsappMessages.workspaceId, user.workspaceId)))
    .orderBy(desc(s.whatsappMessages.createdAt));
}

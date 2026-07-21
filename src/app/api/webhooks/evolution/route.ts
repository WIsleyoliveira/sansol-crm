import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

// Recebe eventos do Evolution API (messages.upsert) para mensagens
// recebidas no WhatsApp conectado. Aponte o webhook do Evolution para
// https://<seu-dominio>/api/webhooks/evolution
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || body.event !== "messages.upsert") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const data = body.data;
  if (!data || data.key?.fromMe) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const remoteJid: string | undefined = data.key?.remoteJid;
  const text: string | undefined = data.message?.conversation ?? data.message?.extendedTextMessage?.text;
  const pushName: string | undefined = data.pushName;
  if (!remoteJid || !text) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const phone = remoteJid.replace(/@.*/, "");

  // Assume workspace único no protótipo (multi-tenant real resolveria pelo instance name)
  const [workspace] = await db.select().from(s.workspaces).limit(1);
  if (!workspace) return NextResponse.json({ ok: false, error: "no workspace" }, { status: 500 });

  let [conv] = await db.select().from(s.whatsappConversations)
    .where(and(eq(s.whatsappConversations.workspaceId, workspace.id), eq(s.whatsappConversations.phone, phone)));

  if (!conv) {
    const [contact] = await db.select().from(s.contacts)
      .where(and(eq(s.contacts.workspaceId, workspace.id), eq(s.contacts.phone, phone)));

    [conv] = await db.insert(s.whatsappConversations).values({
      workspaceId: workspace.id,
      contactId: contact?.id,
      companyId: contact?.companyId,
      phone,
      contactName: contact?.name ?? pushName ?? phone,
      lastMessagePreview: text,
      unreadCount: 1,
    }).returning();
  } else {
    await db.update(s.whatsappConversations).set({
      lastMessageAt: new Date(),
      lastMessagePreview: text,
      unreadCount: conv.unreadCount + 1,
    }).where(eq(s.whatsappConversations.id, conv.id));
  }

  await db.insert(s.whatsappMessages).values({
    workspaceId: workspace.id,
    conversationId: conv.id,
    direction: "in",
    body: text,
    providerMessageId: data.key?.id,
  });

  return NextResponse.json({ ok: true });
}

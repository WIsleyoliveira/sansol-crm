import { redirect } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  Check, CheckCheck, Circle, Kanban as KanbanIcon, MessageCircle, Plus, Send, Target, User,
} from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { moveLeadStatus } from "@/app/actions-presales";
import { sendMessage } from "@/app/actions-whatsapp";
import { Kanban, type KanbanColumn } from "@/components/Kanban";
import { relTime, daysSince } from "@/lib/format";
import { channelLabel, CLASSIFICATION_LABELS } from "@/lib/presalesChannels";

const STATUS_COLUMNS = [
  { id: "novo", name: "Novo" },
  { id: "em_conversa", name: "Em conversa" },
  { id: "qualificado", name: "Qualificado" },
  { id: "convertido", name: "Convertido", isTerminal: true },
  { id: "descartado", name: "Descartado", isTerminal: true },
];

export default async function PreVendasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; c?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "view_pipeline")) redirect("/projetos");

  const { view, c: selectedId } = await searchParams;
  const isChatView = view === "chat";

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl text-[13px] font-semibold px-4 py-2.5 transition-colors ${
      active ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
    }`;

  return (
    <div className={isChatView ? "flex flex-col h-full" : "p-8"}>
      <div className={`flex items-end justify-between ${isChatView ? "px-8 pt-8 pb-4" : "mb-6"}`}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Pré-vendas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Leads antes de virarem oportunidade — qualifique e converta quando estiver pronto.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pre-vendas?view=kanban" className={tabClass(!isChatView)}>
            <KanbanIcon className="h-4 w-4" /> Kanban
          </Link>
          <Link href="/pre-vendas?view=chat" className={tabClass(isChatView)}>
            <MessageCircle className="h-4 w-4" /> Chat
          </Link>
          <Link href="/pre-vendas/novo"
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-white text-[13px] font-semibold px-4 py-2.5 hover:bg-amber-600 shadow-sm transition-colors">
            <Plus className="h-4 w-4" /> Novo lead
          </Link>
        </div>
      </div>

      {isChatView ? (
        <PresalesChat user={{ workspaceId: user.workspaceId }} selectedId={selectedId} />
      ) : (
        <PresalesKanban workspaceId={user.workspaceId} />
      )}
    </div>
  );
}

async function PresalesKanban({ workspaceId }: { workspaceId: string }) {
  const leads = await db.select().from(s.presalesLeads).where(eq(s.presalesLeads.workspaceId, workspaceId));

  const columns: KanbanColumn[] = STATUS_COLUMNS.map((col) => ({
    id: col.id,
    name: col.name,
    isTerminal: col.isTerminal,
    cards: leads
      .filter((l) => l.status === col.id)
      .map((l) => ({
        id: l.id,
        href: `/pre-vendas/${l.id}`,
        title: l.name,
        subtitle: `${channelLabel(l.channel)}${l.socialNetwork ? ` · ${l.socialNetwork}` : ""}`,
        badge: l.classification ? CLASSIFICATION_LABELS[l.classification] : undefined,
        daysInStage: daysSince(l.updatedAt),
      })),
  }));

  async function move(cardId: string, toColumnId: string) {
    "use server";
    await moveLeadStatus(cardId, toColumnId);
  }

  return <Kanban columns={columns} moveAction={move} />;
}

async function PresalesChat({ user, selectedId }: { user: { workspaceId: string }; selectedId?: string }) {
  const conversations = await db.select({
    conv: s.whatsappConversations,
    ownerName: s.users.name,
  }).from(s.whatsappConversations)
    .leftJoin(s.users, eq(s.users.id, s.whatsappConversations.assignedTo))
    .where(and(eq(s.whatsappConversations.workspaceId, user.workspaceId), isNotNull(s.whatsappConversations.presalesLeadId)))
    .orderBy(desc(s.whatsappConversations.lastMessageAt));

  const active = selectedId
    ? conversations.find((c) => c.conv.id === selectedId)
    : conversations[0];

  if (active && active.conv.unreadCount > 0) {
    // Update direto (sem revalidatePath) — mesma ressalva da página /whatsapp.
    await db.update(s.whatsappConversations)
      .set({ unreadCount: 0 })
      .where(eq(s.whatsappConversations.id, active.conv.id));
  }

  const messages = active
    ? await db.select().from(s.whatsappMessages)
        .where(and(eq(s.whatsappMessages.conversationId, active.conv.id), eq(s.whatsappMessages.workspaceId, user.workspaceId)))
        .orderBy(s.whatsappMessages.createdAt)
    : [];

  const lead = active?.conv.presalesLeadId
    ? (await db.select().from(s.presalesLeads).where(eq(s.presalesLeads.id, active.conv.presalesLeadId)))[0]
    : null;

  async function sendAction(formData: FormData) {
    "use server";
    if (!active) return;
    await sendMessage(active.conv.id, formData);
  }

  const statusDot: Record<string, string> = {
    open: "bg-emerald-500", pending: "bg-amber-500", closed: "bg-zinc-400",
  };

  return (
    <div className="flex flex-1 min-h-0 border-t border-zinc-100">
      <div className="w-[340px] shrink-0 border-r border-zinc-100 bg-white flex flex-col overflow-y-auto">
        {conversations.map(({ conv, ownerName }) => {
          const isActive = active?.conv.id === conv.id;
          return (
            <Link key={conv.id} href={`/pre-vendas?view=chat&c=${conv.id}`}
              className={`flex items-start gap-3 px-4 py-3.5 border-b border-zinc-50 transition-colors ${
                isActive ? "bg-amber-50/70" : "hover:bg-zinc-50"
              }`}>
              <div className="relative shrink-0">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-white flex items-center justify-center text-xs font-bold">
                  {conv.contactName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${statusDot[conv.status]}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-zinc-900 truncate">{conv.contactName}</span>
                  <span className="text-[11px] text-zinc-400 shrink-0 tabular-nums">{relTime(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-zinc-500 truncate">{conv.lastMessagePreview}</span>
                  {conv.unreadCount > 0 && (
                    <span className="shrink-0 h-4.5 min-w-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                {ownerName && <div className="text-[10px] text-zinc-400 mt-1">{ownerName}</div>}
              </div>
            </Link>
          );
        })}
        {conversations.length === 0 && (
          <div className="p-8 text-center text-sm text-zinc-400">Nenhuma conversa de pré-venda ainda.</div>
        )}
      </div>

      {active ? (
        <div className="flex-1 flex flex-col bg-[#efe9df] min-w-0">
          <div className="px-6 py-3.5 bg-white border-b border-zinc-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-white flex items-center justify-center text-xs font-bold">
                {active.conv.contactName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900">{active.conv.contactName}</div>
                <div className="text-xs text-zinc-400 tabular-nums">{active.conv.phone}</div>
              </div>
            </div>
            {lead && (
              <Link href={`/pre-vendas/${lead.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors">
                <Target className="h-3.5 w-3.5" /> {lead.name}
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[65%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                  m.direction === "out" ? "bg-[#d9fdd3] text-zinc-800 rounded-br-sm" : "bg-white text-zinc-800 rounded-bl-sm"
                }`}>
                  {m.body}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-zinc-400">{relTime(m.createdAt)}</span>
                    {m.direction === "out" && (
                      m.status === "failed"
                        ? <Circle className="h-3 w-3 text-red-400" />
                        : m.status === "read"
                        ? <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                        : <Check className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="m-auto text-center text-sm text-zinc-500">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
                Nenhuma mensagem ainda.
              </div>
            )}
          </div>

          <form action={sendAction} className="px-6 py-4 bg-white border-t border-zinc-100 flex gap-2 shrink-0">
            <input name="body" required autoComplete="off" placeholder="Digite uma mensagem…"
              className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <button className="h-11 w-11 shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors">
              <Send className="h-4.5 w-4.5" />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#faf9f6] text-zinc-400">
          <div className="text-center">
            <MessageCircle className="h-10 w-10 mx-auto mb-3" />
            Selecione uma conversa
          </div>
        </div>
      )}

      {active && (
        <div className="w-[280px] shrink-0 border-l border-zinc-100 bg-white p-5 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Contato</div>
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <User className="h-4 w-4 text-zinc-400" /> {active.conv.contactName}
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 mt-2 tabular-nums">
              {active.conv.phone}
            </div>
          </div>
          {lead && (
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Origem</div>
              <p className="text-xs text-zinc-600">{channelLabel(lead.channel)}{lead.socialNetwork ? ` · ${lead.socialNetwork}` : ""}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

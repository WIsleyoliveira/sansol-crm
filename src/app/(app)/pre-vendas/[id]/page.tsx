import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  ArrowRight, Flame, MessageCircle, Snowflake, StickyNote, Sun, Target, User,
} from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { setLeadClassification, promoteToOpportunity, openWhatsappForPresalesLead } from "@/app/actions-presales";
import { relTime } from "@/lib/format";
import { channelLabel, CLASSIFICATION_LABELS } from "@/lib/presalesChannels";

export default async function PresalesLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [lead] = await db.select().from(s.presalesLeads)
    .where(and(eq(s.presalesLeads.id, id), eq(s.presalesLeads.workspaceId, user.workspaceId)));
  if (!lead) notFound();

  const acts = await db.select({ act: s.activities, actorName: s.users.name }).from(s.activities)
    .leftJoin(s.users, eq(s.users.id, s.activities.actorId))
    .where(and(eq(s.activities.relatedToType, "presales_lead"), eq(s.activities.relatedToId, id)))
    .orderBy(desc(s.activities.createdAt));

  const card = "rounded-2xl bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.12)]";
  const cardHeader = "px-5 py-4 border-b border-zinc-100 flex items-center gap-2 font-semibold text-sm text-zinc-800";

  const classIcon: Record<string, React.ReactNode> = {
    quente: <Flame className="h-3.5 w-3.5" />,
    morno: <Sun className="h-3.5 w-3.5" />,
    frio: <Snowflake className="h-3.5 w-3.5" />,
  };

  async function classifyAction(classification: "quente" | "morno" | "frio") {
    "use server";
    await setLeadClassification(id, classification);
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6 gap-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{lead.name}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {channelLabel(lead.channel)}{lead.socialNetwork ? ` · ${lead.socialNetwork}` : ""} · {lead.phone}
          </p>
        </div>
        {lead.status !== "convertido" && can(user.role, "manage_records") && (
          <form action={promoteToOpportunity.bind(null, id)}>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white text-sm font-bold px-5 py-3 hover:bg-emerald-500 shadow-sm transition-colors shrink-0">
              Promover a oportunidade <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className={card}>
            <div className={cardHeader}>Timeline</div>
            <div className="divide-y divide-zinc-50">
              {acts.map((a) => {
                const payload = a.act.payload as { text?: string; to?: string };
                return (
                  <div key={a.act.id} className="px-5 py-4 flex gap-3.5">
                    <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center bg-zinc-100 text-zinc-500">
                      <StickyNote className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-zinc-400">
                        {a.act.actorType === "system" ? "Sistema" : a.actorName} · {relTime(a.act.createdAt)}
                      </div>
                      <div className="text-[13px] text-zinc-700 mt-0.5 leading-relaxed">
                        {payload.text ?? (payload.to ? `Movido para "${payload.to}"` : a.act.type)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {acts.length === 0 && <div className="px-5 py-6 text-sm text-zinc-400 text-center">Sem atividades ainda.</div>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${card} p-5`}>
            <div className="font-semibold text-sm text-zinc-800 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-400" /> Contato
            </div>
            <div className="text-sm font-medium text-zinc-900">{lead.name}</div>
            <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">{lead.phone}</div>
            {lead.email && <div className="text-xs text-zinc-500">{lead.email}</div>}
            {lead.notes && <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{lead.notes}</p>}
            {can(user.role, "use_whatsapp") && (
              <form action={openWhatsappForPresalesLead.bind(null, id)} className="mt-3">
                <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition-colors">
                  <MessageCircle className="h-3.5 w-3.5" /> Conversar no WhatsApp
                </button>
              </form>
            )}
          </div>

          <div className={`${card} p-5`}>
            <div className="font-semibold text-sm text-zinc-800 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-zinc-400" /> Classificação
            </div>
            <div className="flex gap-2">
              {(["quente", "morno", "frio"] as const).map((c) => (
                <form key={c} action={classifyAction.bind(null, c)}>
                  <button className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-2 transition-colors ${
                    lead.classification === c
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}>
                    {classIcon[c]} {CLASSIFICATION_LABELS[c]}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

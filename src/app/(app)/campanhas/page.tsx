import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { Megaphone, Play, Pause, Users, Send } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { db, schema as s } from "@/db";
import { PageHeader, SectionCard, Badge, EmptyState, card } from "@/components/ui";
import { createCampaign, startCampaign, pauseCampaign } from "@/app/actions-campaigns";

const statusTone: Record<string, "green" | "amber" | "blue" | "zinc"> = {
  running: "green", draft: "zinc", paused: "amber", done: "blue",
};
const statusLabel: Record<string, string> = {
  running: "Em execução", draft: "Rascunho", paused: "Pausada", done: "Concluída",
};

export default async function CampanhasPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "use_whatsapp")) redirect("/");

  const camps = await db.select().from(s.campaigns)
    .where(eq(s.campaigns.workspaceId, user.workspaceId))
    .orderBy(desc(s.campaigns.createdAt));

  const counts = await db.select({
    campaignId: s.campaignRecipients.campaignId,
    status: s.campaignRecipients.status,
    n: sql<number>`count(*)`,
  }).from(s.campaignRecipients)
    .where(eq(s.campaignRecipients.workspaceId, user.workspaceId))
    .groupBy(s.campaignRecipients.campaignId, s.campaignRecipients.status);

  const byCamp = new Map<string, { total: number; sent: number; failed: number; queued: number }>();
  for (const c of counts) {
    const cur = byCamp.get(c.campaignId) ?? { total: 0, sent: 0, failed: 0, queued: 0 };
    const n = Number(c.n);
    cur.total += n;
    if (c.status === "sent") cur.sent += n;
    else if (c.status === "failed") cur.failed += n;
    else if (c.status === "queued") cur.queued += n;
    byCamp.set(c.campaignId, cur);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        module="Vendas"
        title="Campanhas WhatsApp"
        subtitle="Dispare mensagens em massa para contatos ou leads. O envio é feito com intervalo entre mensagens para proteger o número contra bloqueios."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Criar campanha */}
        <SectionCard title="Nova campanha">
          <form action={createCampaign} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Nome</label>
              <input name="name" required placeholder="Ex: Promoção de julho"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Mensagem</label>
              <textarea name="body" required rows={5} placeholder={"Olá {{nome}}! Temos uma novidade em energia solar pra você..."}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400 resize-none" />
              <p className="text-[11px] text-zinc-400 mt-1">Use <code className="text-amber-600">{"{{nome}}"}</code> para inserir o primeiro nome do destinatário.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Público</label>
              <select name="audience"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white">
                <option value="contatos">Todos os contatos</option>
                <option value="leads">Todos os leads de pré-venda</option>
              </select>
            </div>
            <button type="submit"
              className="w-full rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-semibold py-2.5 shadow-lg shadow-amber-500/25 hover:brightness-105 transition">
              Criar campanha (rascunho)
            </button>
          </form>
        </SectionCard>

        {/* Lista de campanhas */}
        <SectionCard title="Campanhas">
          {camps.length === 0 ? (
            <EmptyState title="Nenhuma campanha ainda" hint="Crie a primeira ao lado." />
          ) : (
            <div className="divide-y divide-zinc-100">
              {camps.map((camp) => {
                const c = byCamp.get(camp.id) ?? { total: 0, sent: 0, failed: 0, queued: 0 };
                const pct = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0;
                const start = startCampaign.bind(null, camp.id);
                const pause = pauseCampaign.bind(null, camp.id);
                return (
                  <div key={camp.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-zinc-800 truncate">{camp.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{camp.body}</div>
                      </div>
                      <Badge tone={statusTone[camp.status] ?? "zinc"}>{statusLabel[camp.status] ?? camp.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Users className="h-3.5 w-3.5" /> {c.total} destinatários
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                        <Send className="h-3.5 w-3.5" /> {c.sent} enviadas
                      </div>
                      {c.failed > 0 && <span className="text-[11px] text-red-500">{c.failed} falhas</span>}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      {(camp.status === "draft" || camp.status === "paused") && c.queued > 0 && (
                        <form action={start}>
                          <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 hover:bg-emerald-600 transition">
                            <Play className="h-3.5 w-3.5" /> Iniciar
                          </button>
                        </form>
                      )}
                      {camp.status === "running" && (
                        <form action={pause}>
                          <button className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 hover:bg-amber-200 transition">
                            <Pause className="h-3.5 w-3.5" /> Pausar
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className={`${card} p-4 mt-6 flex items-start gap-3`}>
        <Megaphone className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-500">
          Ao clicar em <b>Iniciar</b>, a campanha fica <b>Em execução</b> e o robô (n8n) começa a disparar as mensagens,
          uma a cada poucos segundos, respeitando um limite diário para não sobrecarregar o número.
        </p>
      </div>
    </div>
  );
}

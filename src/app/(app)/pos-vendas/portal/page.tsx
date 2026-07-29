import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { Sun, Leaf, Wallet, Zap, ShieldCheck, LifeBuoy } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { brl, kwp, dateBR } from "@/lib/format";
import { PageHeader, EmptyState, card } from "@/components/ui";

const TARIFF = 0.92; // R$/kWh de referência p/ estimar economia

export default async function PortalPage() {
  const user = await requireUser();
  if (!can(user.role, "view_aftersales")) redirect("/");

  const [row] = await db.select({ p: s.plants, companyName: s.companies.name })
    .from(s.plants)
    .leftJoin(s.companies, eq(s.companies.id, s.plants.companyId))
    .where(eq(s.plants.workspaceId, user.workspaceId))
    .orderBy(desc(s.plants.totalKwh)).limit(1);

  const readings = row
    ? await db.select().from(s.plantReadings).where(eq(s.plantReadings.plantId, row.p.id)).orderBy(asc(s.plantReadings.date))
    : [];

  return (
    <div className="p-8 max-w-[1100px]">
      <PageHeader module="Pós-vendas" title="Portal do Cliente"
        subtitle="Prévia da experiência que o cliente final acessa: geração, economia e suporte da sua usina." />

      {!row ? (
        <div className={card}><EmptyState title="Nenhuma usina disponível para prévia." /></div>
      ) : (
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl overflow-hidden shadow-xl border border-zinc-200 bg-white">
            {/* Header do portal */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-7 pb-8 text-white">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-2xl bg-white/20 flex items-center justify-center"><Sun className="h-5 w-5" /></div>
                <div className="font-bold">Sansol · Minha Usina</div>
              </div>
              <div className="mt-4 text-white/80 text-xs uppercase tracking-wide">{row.companyName}</div>
              <div className="text-2xl font-bold">{row.p.name}</div>
              <div className="text-white/90 text-sm mt-0.5">{kwp(row.p.capacityKwp)} · desde {dateBR(row.p.commissionedAt)}</div>
            </div>

            <div className="p-5 space-y-4 -mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm p-4">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2"><Zap className="h-4 w-4" /></div>
                  <div className="text-xl font-bold text-zinc-900 tabular-nums">{(parseFloat(row.p.monthKwh)).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
                  <div className="text-[11px] text-zinc-400">kWh gerados este mês</div>
                </div>
                <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm p-4">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2"><Wallet className="h-4 w-4" /></div>
                  <div className="text-xl font-bold text-zinc-900 tabular-nums">{brl(parseFloat(row.p.monthKwh) * TARIFF)}</div>
                  <div className="text-[11px] text-zinc-400">economia estimada no mês</div>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-zinc-700">Geração — últimos 30 dias</span>
                  <span className="text-[11px] text-zinc-400">total {(parseFloat(row.p.totalKwh) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MWh</span>
                </div>
                <PortalBars readings={readings} />
              </div>

              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-center gap-3">
                <Leaf className="h-8 w-8 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold text-emerald-800">
                    {(parseFloat(row.p.totalKwh) * 0.0817 / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t de CO₂ evitadas
                  </div>
                  <div className="text-[11px] text-emerald-600">equivalente a plantar {Math.round(parseFloat(row.p.totalKwh) * 0.0817 / 22)} árvores</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button className="rounded-xl bg-zinc-900 text-white text-[13px] font-semibold py-3 flex items-center justify-center gap-2"><LifeBuoy className="h-4 w-4" /> Abrir chamado</button>
                <button className="rounded-xl bg-white border border-zinc-200 text-zinc-700 text-[13px] font-semibold py-3 flex items-center justify-center gap-2"><ShieldCheck className="h-4 w-4" /> Garantia</button>
              </div>
            </div>
          </div>
          <p className="text-center text-[11px] text-zinc-400 mt-3">Prévia — o cliente acessa esta tela por link próprio ou app white-label.</p>
        </div>
      )}
    </div>
  );
}

function PortalBars({ readings }: { readings: { generationKwh: string }[] }) {
  if (readings.length === 0) return <div className="text-xs text-zinc-400">Sem leituras.</div>;
  const vals = readings.map((r) => parseFloat(r.generationKwh));
  const max = Math.max(...vals, 1);
  return (
    <div className="flex items-end gap-[3px] h-20">
      {vals.map((v, i) => (
        <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-amber-300 to-orange-400" style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={`${v.toFixed(0)} kWh`} />
      ))}
    </div>
  );
}

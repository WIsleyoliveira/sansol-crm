import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Share2, Zap } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { kwp } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";

const modalityLabel: Record<string, string> = { self: "Autoconsumo", shared: "Geração compartilhada", remote: "Autoconsumo remoto" };

export default async function RateioPage() {
  const user = await requireUser();
  if (!can(user.role, "view_engineering")) redirect("/");

  const plants = await db.select().from(s.creditPlants).where(eq(s.creditPlants.workspaceId, user.workspaceId));
  const allBeneficiaries = plants.length
    ? await db.select().from(s.creditBeneficiaries)
    : [];
  const byPlant = (pid: string) => allBeneficiaries.filter((b) => b.plantId === pid);

  return (
    <div className="p-8 space-y-6 max-w-[1200px]">
      <PageHeader module="Engenharia" title="Rateio de Créditos"
        subtitle="Distribuição automática dos créditos de geração entre unidades consumidoras (Lei 14.300 / geração compartilhada)." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Usinas geradoras" value={String(plants.length)} Icon={Share2} tint="bg-violet-50 text-violet-600" />
        <Kpi label="Unidades beneficiárias" value={String(allBeneficiaries.length)} />
        <Kpi label="Geração total" value={kwp(plants.reduce((a, p) => a + parseFloat(p.capacityKwp), 0))} Icon={Zap} tint="bg-amber-50 text-amber-600" />
      </div>

      {plants.length === 0 && <div className={card}><EmptyState title="Nenhuma usina com rateio configurado." /></div>}

      {plants.map((p) => {
        const bens = byPlant(p.id);
        const totalPct = bens.reduce((a, b) => a + parseFloat(b.sharePct), 0);
        const gen = p.avgGenerationKwhMonth;
        return (
          <div key={p.id} className={card}>
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-zinc-800">{p.name}</div>
                <div className="text-xs text-zinc-400 mt-0.5">UC geradora {p.generatingUc} · {gen.toLocaleString("pt-BR")} kWh/mês · {kwp(p.capacityKwp)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="violet">{modalityLabel[p.modality]}</Badge>
                <Badge tone={Math.abs(totalPct - 100) < 0.01 ? "green" : "red"}>{totalPct.toFixed(0)}% alocado</Badge>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                  <th className="px-5 py-2.5 font-semibold">Unidade beneficiária</th>
                  <th className="px-3 py-2.5 font-semibold">UC</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Consumo</th>
                  <th className="px-3 py-2.5 font-semibold text-right">% rateio</th>
                  <th className="px-3 py-2.5 font-semibold">Distribuição</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Créditos/mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {bens.map((b) => {
                  const pct = parseFloat(b.sharePct);
                  const credits = Math.round(gen * pct / 100);
                  return (
                    <tr key={b.id} className="hover:bg-zinc-50/60">
                      <td className="px-5 py-3 font-medium text-zinc-800">{b.name}</td>
                      <td className="px-3 py-3 text-zinc-400 text-[13px] font-mono">{b.uc}</td>
                      <td className="px-3 py-3 text-right text-zinc-500 tabular-nums">{b.avgConsumptionKwh.toLocaleString("pt-BR")} kWh</td>
                      <td className="px-3 py-3 text-right font-semibold text-zinc-900 tabular-nums">{pct.toFixed(1)}%</td>
                      <td className="px-3 py-3 w-40">
                        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700 tabular-nums">{credits.toLocaleString("pt-BR")} kWh</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

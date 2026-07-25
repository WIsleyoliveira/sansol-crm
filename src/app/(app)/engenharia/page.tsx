import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Ruler, Zap } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { kwp } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";
import { SolarCalculator } from "@/components/SolarCalculator";

const statusTone: Record<string, "green" | "amber" | "blue"> = { issued: "green", approved: "blue", draft: "amber" };
const statusLabel: Record<string, string> = { issued: "Emitido", approved: "Aprovado", draft: "Em projeto" };

export default async function EngenhariaPage() {
  const user = await requireUser();
  if (!can(user.role, "view_engineering")) redirect("/");

  const rows = await db.select({ d: s.engineeringDesigns, oppName: s.opportunities.name, oppId: s.opportunities.id })
    .from(s.engineeringDesigns)
    .leftJoin(s.opportunities, eq(s.opportunities.id, s.engineeringDesigns.opportunityId))
    .where(eq(s.engineeringDesigns.workspaceId, user.workspaceId))
    .orderBy(desc(s.engineeringDesigns.createdAt));

  const totalKwp = rows.reduce((a, r) => a + parseFloat(r.d.systemSizeKwp), 0);

  return (
    <div className="p-8 space-y-6 max-w-[1400px]">
      <PageHeader module="Engenharia" title="Dimensionamento"
        subtitle="Projetos técnicos: potência, geração e área. Calculadora automática + registro dos projetos." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Projetos técnicos" value={String(rows.length)} Icon={Ruler} tint="bg-sky-50 text-sky-600" />
        <Kpi label="Potência projetada" value={kwp(totalKwp)} Icon={Zap} tint="bg-amber-50 text-amber-600" />
        <Kpi label="Aprovados p/ execução" value={String(rows.filter((r) => r.d.status !== "draft").length)} tint="bg-emerald-50 text-emerald-600" />
      </div>

      <SolarCalculator />

      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-zinc-100 font-semibold text-sm text-zinc-800">Projetos dimensionados</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
              <th className="px-5 py-3 font-semibold">Negócio</th>
              <th className="px-3 py-3 font-semibold text-right">Consumo</th>
              <th className="px-3 py-3 font-semibold text-right">Potência</th>
              <th className="px-3 py-3 font-semibold text-right">Painéis</th>
              <th className="px-3 py-3 font-semibold">Inversor</th>
              <th className="px-3 py-3 font-semibold text-right">Geração</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map(({ d, oppId, oppName }) => (
              <tr key={d.id} className="hover:bg-zinc-50/60">
                <td className="px-5 py-3">
                  <Link href={`/oportunidades/${oppId}`} className="font-medium text-zinc-800 hover:text-amber-600">{oppName}</Link>
                </td>
                <td className="px-3 py-3 text-right text-zinc-500 tabular-nums">{d.avgConsumptionKwh.toLocaleString("pt-BR")} kWh</td>
                <td className="px-3 py-3 text-right font-semibold text-zinc-900 tabular-nums">{kwp(d.systemSizeKwp)}</td>
                <td className="px-3 py-3 text-right text-zinc-600 tabular-nums">{d.panelQty}× {d.panelWatts}W</td>
                <td className="px-3 py-3 text-zinc-500 text-[13px]">{d.inverterModel}</td>
                <td className="px-3 py-3 text-right text-emerald-700 tabular-nums">{d.estimatedGenerationKwhMonth?.toLocaleString("pt-BR")} kWh</td>
                <td className="px-5 py-3"><Badge tone={statusTone[d.status]}>{statusLabel[d.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="Nenhum projeto dimensionado." />}
      </div>
    </div>
  );
}

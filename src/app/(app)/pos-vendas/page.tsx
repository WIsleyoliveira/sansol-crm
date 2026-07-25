import { redirect } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { Activity, Sun, Zap, AlertTriangle, Gauge } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { kwp, relTime } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";

const statusMeta: Record<string, { tone: "green" | "red" | "amber"; label: string; dot: string }> = {
  online: { tone: "green", label: "Online", dot: "bg-emerald-500" },
  offline: { tone: "red", label: "Offline", dot: "bg-red-500" },
  warning: { tone: "amber", label: "Atenção", dot: "bg-amber-500" },
};

function GenChart({ readings }: { readings: { generationKwh: string }[] }) {
  if (readings.length < 2) return null;
  const vals = readings.map((r) => parseFloat(r.generationKwh));
  const max = Math.max(...vals, 1);
  const w = 280, h = 60;
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 6) - 3).toFixed(1)}`);
  const area = `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#genGrad)" />
      <polyline points={pts.join(" ")} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export default async function PosVendasPage() {
  const user = await requireUser();
  if (!can(user.role, "view_aftersales")) redirect("/");

  const plants = await db.select({ p: s.plants, companyName: s.companies.name })
    .from(s.plants)
    .leftJoin(s.companies, eq(s.companies.id, s.plants.companyId))
    .where(eq(s.plants.workspaceId, user.workspaceId))
    .orderBy(desc(s.plants.capacityKwp));

  const plantIds = plants.map((x) => x.p.id);
  const readings = plantIds.length
    ? await db.select().from(s.plantReadings).where(inArray(s.plantReadings.plantId, plantIds)).orderBy(asc(s.plantReadings.date))
    : [];
  const readingsByPlant = (pid: string) => readings.filter((r) => r.plantId === pid);

  const totalKwp = plants.reduce((a, x) => a + parseFloat(x.p.capacityKwp), 0);
  const totalToday = plants.reduce((a, x) => a + parseFloat(x.p.todayKwh), 0);
  const online = plants.filter((x) => x.p.status === "online").length;
  const alerts = plants.filter((x) => x.p.status !== "online");

  return (
    <div className="p-8 space-y-6 max-w-[1400px]">
      <PageHeader module="Pós-vendas" title="Monitoramento de Usinas"
        subtitle="Geração em tempo real das usinas instaladas. Integrável com ShinePhone, Solar.web, SolarView e outros." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Usinas monitoradas" value={String(plants.length)} sub={`${online} online`} Icon={Activity} tint="bg-emerald-50 text-emerald-600" />
        <Kpi label="Potência total" value={kwp(totalKwp)} Icon={Zap} tint="bg-amber-50 text-amber-600" />
        <Kpi label="Geração hoje" value={`${totalToday.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh`} Icon={Sun} tint="bg-sky-50 text-sky-600" />
        <Kpi label="Alertas" value={String(alerts.length)} sub="usinas offline / atenção" Icon={AlertTriangle} tint="bg-red-50 text-red-600" />
      </div>

      {plants.length === 0 && <div className={card}><EmptyState title="Nenhuma usina em monitoramento." /></div>}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {plants.map(({ p, companyName }) => {
          const meta = statusMeta[p.status];
          const pr = p.performanceRatio ? parseFloat(p.performanceRatio) : null;
          return (
            <div key={p.id} className={`${card} p-5`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-zinc-800">{p.name}</div>
                  <div className="text-xs text-zinc-400">{companyName} · {kwp(p.capacityKwp)}</div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className={`h-2 w-2 rounded-full ${meta.dot} ${p.status === "online" ? "animate-pulse" : ""}`} />
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </span>
              </div>

              <div className="mt-3"><GenChart readings={readingsByPlant(p.id)} /></div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <div className="text-[15px] font-bold text-zinc-900 tabular-nums">{parseFloat(p.todayKwh).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide">kWh hoje</div>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-zinc-900 tabular-nums">{(parseFloat(p.monthKwh) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide">kWh mês</div>
                </div>
                <div>
                  <div className={`text-[15px] font-bold tabular-nums ${pr && pr < 0.75 ? "text-amber-600" : "text-zinc-900"}`}>{pr ? `${(pr * 100).toFixed(0)}%` : "—"}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide flex items-center justify-center gap-0.5"><Gauge className="h-2.5 w-2.5" />PR</div>
                </div>
              </div>
              <div className="text-[11px] text-zinc-400 mt-3 pt-3 border-t border-zinc-50">
                {p.inverterBrand} · {p.monitoringProvider} · atualizado {relTime(p.lastReadingAt ?? p.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

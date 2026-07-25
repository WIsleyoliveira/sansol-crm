import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Zap } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { kwp } from "@/lib/format";
import { PageHeader, EmptyState, card } from "@/components/ui";

type Unifilar = { modules?: number; strings?: number; breakerA?: number; cableMm2?: number };

function UnifilarSVG({ design }: { design: typeof s.engineeringDesigns.$inferSelect }) {
  const u = (design.unifilar ?? {}) as Unifilar;
  const strings = u.strings ?? Math.max(1, Math.round((design.panelQty ?? 12) / 14));
  const modules = u.modules ?? design.panelQty ?? 12;
  const perString = Math.round(modules / strings);
  const breakerA = u.breakerA ?? 40;
  const cable = u.cableMm2 ?? 6;

  const box = (x: number, y: number, w: number, h: number, label: string, sub?: string, fill = "#fff") => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke="#d4d4d8" strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 4)} textAnchor="middle" fontSize={12} fontWeight={700} fill="#27272a">{label}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={10} fill="#71717a">{sub}</text>}
    </g>
  );
  const line = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a1a1aa" strokeWidth={1.5} />;

  return (
    <svg viewBox="0 0 760 360" className="w-full" style={{ maxHeight: 380 }}>
      {/* Strings de módulos */}
      {Array.from({ length: strings }).map((_, i) => {
        const y = 40 + i * (280 / strings);
        return (
          <g key={i}>
            {box(20, y, 150, 44, `String ${i + 1}`, `${perString} × ${design.panelWatts}Wp`, "#fffbeb")}
            {line(170, y + 22, 250, y + 22)}
          </g>
        );
      })}
      {/* Barramento CC */}
      {line(250, 62, 250, 62 + (strings - 1) * (280 / strings))}
      {box(250, 130, 130, 56, "Inversor", `${design.inverterKw} kW`, "#eff6ff")}
      {line(380, 158, 440, 158)}
      {box(440, 130, 120, 56, "Disjuntor CA", `${breakerA} A`, "#fff")}
      {line(560, 158, 610, 158)}
      {box(610, 130, 120, 56, "Medidor", "bidirecional", "#f0fdf4")}
      {line(670, 130, 670, 90)}
      {box(610, 40, 120, 50, "Rede", "concessionária", "#fef2f2")}
      {/* rótulo cabo */}
      <text x={295} y={120} fontSize={10} fill="#71717a">cabo {cable}mm²</text>
    </svg>
  );
}

export default async function UnifilarPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "view_engineering")) redirect("/");
  const { id } = await searchParams;

  const rows = await db.select({ d: s.engineeringDesigns, oppName: s.opportunities.name })
    .from(s.engineeringDesigns)
    .leftJoin(s.opportunities, eq(s.opportunities.id, s.engineeringDesigns.opportunityId))
    .where(eq(s.engineeringDesigns.workspaceId, user.workspaceId))
    .orderBy(desc(s.engineeringDesigns.createdAt));

  const selected = rows.find((r) => r.d.id === id) ?? rows[0];

  return (
    <div className="p-8 space-y-6 max-w-[1300px]">
      <PageHeader module="Engenharia" title="Diagrama Unifilar"
        subtitle="Gerado automaticamente a partir do dimensionamento: strings, inversor, proteção e medição." />

      {rows.length === 0 ? (
        <div className={card}><EmptyState title="Nenhum projeto para diagramar." hint="Crie um dimensionamento primeiro." /></div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-5">
          <div className={`${card} lg:col-span-1 overflow-hidden h-fit`}>
            <div className="px-4 py-3 border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">Projetos</div>
            <div className="divide-y divide-zinc-50">
              {rows.map(({ d, oppName }) => (
                <Link key={d.id} href={`/engenharia/unifilar?id=${d.id}`}
                  className={`block px-4 py-3 text-[13px] transition-colors ${selected?.d.id === d.id ? "bg-amber-50/70 text-amber-900 font-semibold" : "text-zinc-600 hover:bg-zinc-50"}`}>
                  {oppName}
                  <div className="text-xs text-zinc-400 mt-0.5">{kwp(d.systemSizeKwp)}</div>
                </Link>
              ))}
            </div>
          </div>

          {selected && (
            <div className={`${card} lg:col-span-3 p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Zap className="h-4 w-4" /></div>
                <div>
                  <div className="font-semibold text-zinc-800">{selected.oppName}</div>
                  <div className="text-xs text-zinc-400">{kwp(selected.d.systemSizeKwp)} · {selected.d.panelQty} módulos · {selected.d.inverterModel}</div>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/40 p-4">
                <UnifilarSVG design={selected.d} />
              </div>
              <p className="text-[11px] text-zinc-400 mt-3">
                Diagrama esquemático conforme dimensionamento. Para homologação, exportar prancha assinada por responsável técnico (ART).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

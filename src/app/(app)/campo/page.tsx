import { redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { MapPin, Clock, CheckCircle2, Circle, Wrench, Phone } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { dateBR, relTime } from "@/lib/format";
import { advanceServiceOrder } from "@/app/actions-ops";

const statusLabel: Record<string, string> = { in_progress: "Em andamento", scheduled: "Agendada" };

export default async function CampoPage() {
  const user = await requireUser();
  if (!can(user.role, "view_installs") && !can(user.role, "view_ops")) redirect("/");

  const mine = await db.select({ o: s.serviceOrders, companyName: s.companies.name, address: s.sites.address, city: s.sites.city, phone: s.contacts.phone })
    .from(s.serviceOrders)
    .leftJoin(s.companies, eq(s.companies.id, s.serviceOrders.companyId))
    .leftJoin(s.sites, eq(s.sites.id, s.serviceOrders.siteId))
    .leftJoin(s.contacts, eq(s.contacts.companyId, s.serviceOrders.companyId))
    .where(and(
      eq(s.serviceOrders.workspaceId, user.workspaceId),
      eq(s.serviceOrders.technicianId, user.id),
      ne(s.serviceOrders.status, "done"),
    ))
    .orderBy(asc(s.serviceOrders.scheduledAt));

  return (
    <div className="min-h-full bg-zinc-100 flex justify-center">
      <div className="w-full max-w-md bg-zinc-50 min-h-full">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-8 pb-6 text-white">
          <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wide">
            <Wrench className="h-3.5 w-3.5" /> App do Técnico
          </div>
          <div className="text-2xl font-bold mt-1">Olá, {user.name.split(" ")[0]}</div>
          <div className="text-white/90 text-sm mt-0.5">{mine.length} ordem(ns) de serviço para você</div>
        </div>

        <div className="p-4 space-y-4 -mt-3">
          {mine.map(({ o, companyName, address, city, phone }) => {
            const checklist = (o.checklist ?? []) as { item: string; done: boolean }[];
            const doneCount = checklist.filter((c) => c.done).length;
            const maps = `https://maps.google.com/?q=${encodeURIComponent(`${address ?? ""} ${city ?? ""}`)}`;
            return (
              <div key={o.id} className="rounded-2xl bg-white shadow-sm border border-zinc-100 overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-zinc-400">{o.number}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${o.status === "in_progress" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                      {statusLabel[o.status] ?? o.status}
                    </span>
                  </div>
                  <div className="text-[15px] font-bold text-zinc-900 mt-1">{companyName}</div>
                  <div className="text-[13px] text-zinc-500">{o.description}</div>

                  <div className="mt-3 flex items-center gap-2 text-[13px] text-zinc-600">
                    <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                    {o.scheduledAt ? `${dateBR(o.scheduledAt)} · ${relTime(o.scheduledAt)}` : "Sem horário"}
                  </div>
                  {(address || city) && (
                    <a href={maps} target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-2 text-[13px] text-sky-600 font-medium">
                      <MapPin className="h-4 w-4 shrink-0" /> {[address, city].filter(Boolean).join(", ")}
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`} className="mt-1.5 flex items-center gap-2 text-[13px] text-emerald-600 font-medium">
                      <Phone className="h-4 w-4 shrink-0" /> {phone}
                    </a>
                  )}
                </div>

                {checklist.length > 0 && (
                  <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-2">Checklist {doneCount}/{checklist.length}</div>
                    <div className="space-y-1.5">
                      {checklist.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[13px]">
                          {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <Circle className="h-4 w-4 text-zinc-300 shrink-0" />}
                          <span className={c.done ? "text-zinc-400 line-through" : "text-zinc-700"}>{c.item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form action={advanceServiceOrder.bind(null, o.id)} className="p-3 border-t border-zinc-100">
                  <button className="w-full rounded-xl bg-zinc-900 text-white text-sm font-semibold py-3 active:scale-[0.99] transition-transform">
                    {o.status === "scheduled" ? "Iniciar atendimento" : "Concluir OS"}
                  </button>
                </form>
              </div>
            );
          })}
          {mine.length === 0 && (
            <div className="rounded-2xl bg-white border border-zinc-100 p-8 text-center text-sm text-zinc-400">
              Nenhuma OS aberta atribuída a você. 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

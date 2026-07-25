import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { brl, dateBR, daysSince } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";
import { markReceivableReceived } from "@/app/actions-finance";

const statusTone: Record<string, "green" | "amber" | "red"> = { received: "green", open: "amber", overdue: "red" };
const statusLabel: Record<string, string> = { received: "Recebida", open: "Em aberto", overdue: "Atrasada" };

export default async function ReceberPage() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) redirect("/");

  const rows = await db.select({
    r: s.receivables,
    companyName: s.companies.name,
  }).from(s.receivables)
    .leftJoin(s.companies, eq(s.companies.id, s.receivables.companyId))
    .where(eq(s.receivables.workspaceId, user.workspaceId))
    .orderBy(asc(s.receivables.dueDate));

  const open = rows.filter((x) => x.r.status !== "received");
  const totalOpen = open.reduce((a, x) => a + parseFloat(x.r.amount), 0);
  const overdue = rows.filter((x) => x.r.status === "overdue");
  const received = rows.filter((x) => x.r.status === "received").reduce((a, x) => a + parseFloat(x.r.amount), 0);

  return (
    <div className="p-8 space-y-6 max-w-[1400px]">
      <PageHeader module="Financeiro" title="Contas a Receber"
        subtitle="Parcelas de contratos e entradas. Dar baixa credita automaticamente na conta bancária."
        action={
          <Link href="/financeiro/receber/nova" className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-4 py-2.5 hover:bg-zinc-700 shadow-sm transition-colors shrink-0">
            <Plus className="h-4 w-4" /> Novo recebível
          </Link>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="A receber (aberto)" value={brl(totalOpen)} sub={`${open.length} títulos`} tint="bg-sky-50 text-sky-600" />
        <Kpi label="Em atraso" value={brl(overdue.reduce((a, x) => a + parseFloat(x.r.amount), 0))} sub={`${overdue.length} títulos`} tint="bg-red-50 text-red-600" />
        <Kpi label="Recebido (histórico)" value={brl(received)} tint="bg-emerald-50 text-emerald-600" />
      </div>

      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
              <th className="px-5 py-3 font-semibold">Descrição</th>
              <th className="px-3 py-3 font-semibold">Cliente</th>
              <th className="px-3 py-3 font-semibold">Parcela</th>
              <th className="px-3 py-3 font-semibold">Vencimento</th>
              <th className="px-3 py-3 font-semibold text-right">Valor</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map(({ r, companyName }) => {
              const overdueRow = r.status === "overdue";
              return (
                <tr key={r.id} className="hover:bg-zinc-50/60">
                  <td className="px-5 py-3 font-medium text-zinc-800">{r.description}</td>
                  <td className="px-3 py-3 text-zinc-500 text-[13px]">{companyName ?? "—"}</td>
                  <td className="px-3 py-3 text-zinc-500 text-[13px] tabular-nums">{r.installmentNo && r.installmentTotal ? `${r.installmentNo}/${r.installmentTotal}` : "—"}</td>
                  <td className={`px-3 py-3 text-[13px] tabular-nums ${overdueRow ? "text-red-600 font-medium" : "text-zinc-600"}`}>
                    {dateBR(r.dueDate)}{overdueRow ? ` · há ${daysSince(r.dueDate)}d` : ""}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-zinc-900 tabular-nums">{brl(r.amount)}</td>
                  <td className="px-3 py-3"><Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    {r.status !== "received" ? (
                      <form action={markReceivableReceived.bind(null, r.id)}>
                        <button className="rounded-lg bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-emerald-500 transition-colors">
                          Dar baixa
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-zinc-400">{dateBR(r.receivedAt)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="Nenhuma conta a receber." />}
      </div>
    </div>
  );
}

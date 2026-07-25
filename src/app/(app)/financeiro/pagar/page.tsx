import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { brl, dateBR, daysSince } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";
import { markPayablePaid } from "@/app/actions-finance";

const novaBtn = (href: string, text: string) => (
  <Link href={href} className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-4 py-2.5 hover:bg-zinc-700 shadow-sm transition-colors shrink-0">
    <Plus className="h-4 w-4" /> {text}
  </Link>
);

const catLabel: Record<string, string> = {
  equipment: "Equipamentos", payroll: "Folha", tax: "Impostos", rent: "Aluguel",
  marketing: "Marketing", logistics: "Logística", other: "Outros",
};
const statusTone: Record<string, "green" | "amber" | "red" | "zinc" | "blue"> = {
  paid: "green", scheduled: "blue", open: "amber", overdue: "red",
};
const statusLabel: Record<string, string> = { paid: "Paga", scheduled: "Agendada", open: "Em aberto", overdue: "Vencida" };

export default async function PagarPage() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) redirect("/");

  const rows = await db.select().from(s.payables)
    .where(eq(s.payables.workspaceId, user.workspaceId))
    .orderBy(asc(s.payables.dueDate));

  const open = rows.filter((r) => r.status !== "paid");
  const totalOpen = open.reduce((a, r) => a + parseFloat(r.amount), 0);
  const overdue = rows.filter((r) => r.status === "overdue");
  const paidThisList = rows.filter((r) => r.status === "paid").reduce((a, r) => a + parseFloat(r.amount), 0);

  return (
    <div className="p-8 space-y-6 max-w-[1400px]">
      <PageHeader module="Financeiro" title="Contas a Pagar"
        subtitle="Títulos e despesas. Baixe o pagamento para debitar automaticamente da conta bancária."
        action={novaBtn("/financeiro/pagar/nova", "Nova conta")} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Total em aberto" value={brl(totalOpen)} sub={`${open.length} títulos`} />
        <Kpi label="Vencidas" value={brl(overdue.reduce((a, r) => a + parseFloat(r.amount), 0))} sub={`${overdue.length} títulos`} tint="bg-red-50 text-red-600" />
        <Kpi label="Pagas (histórico)" value={brl(paidThisList)} />
      </div>

      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
              <th className="px-5 py-3 font-semibold">Descrição</th>
              <th className="px-3 py-3 font-semibold">Categoria</th>
              <th className="px-3 py-3 font-semibold">Vencimento</th>
              <th className="px-3 py-3 font-semibold text-right">Valor</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map((r) => {
              const overdueRow = r.status === "overdue";
              return (
                <tr key={r.id} className="hover:bg-zinc-50/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-zinc-800">{r.description}</div>
                    <div className="text-xs text-zinc-400">{r.supplier ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-zinc-500 text-[13px]">{catLabel[r.category]}</td>
                  <td className={`px-3 py-3 text-[13px] tabular-nums ${overdueRow ? "text-red-600 font-medium" : "text-zinc-600"}`}>
                    {dateBR(r.dueDate)}{overdueRow ? ` · há ${daysSince(r.dueDate)}d` : ""}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-zinc-900 tabular-nums">{brl(r.amount)}</td>
                  <td className="px-3 py-3"><Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    {r.status !== "paid" ? (
                      <form action={markPayablePaid.bind(null, r.id)}>
                        <button className="rounded-lg bg-zinc-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-zinc-700 transition-colors">
                          Baixar
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-zinc-400">{dateBR(r.paidAt)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="Nenhuma conta a pagar." />}
      </div>
    </div>
  );
}

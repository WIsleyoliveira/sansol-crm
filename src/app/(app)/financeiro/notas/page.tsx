import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ReceiptText } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { brl, dateBR } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";

const statusTone: Record<string, "green" | "amber" | "red" | "zinc"> = { issued: "green", draft: "amber", canceled: "zinc", error: "red" };
const statusLabel: Record<string, string> = { issued: "Emitida", draft: "Rascunho", canceled: "Cancelada", error: "Erro" };

export default async function NotasPage() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) redirect("/");

  const rows = await db.select({ inv: s.invoices, companyName: s.companies.name })
    .from(s.invoices)
    .leftJoin(s.companies, eq(s.companies.id, s.invoices.companyId))
    .where(eq(s.invoices.workspaceId, user.workspaceId))
    .orderBy(desc(s.invoices.createdAt));

  const issued = rows.filter((x) => x.inv.status === "issued");
  const totalIssued = issued.reduce((a, x) => a + parseFloat(x.inv.amount), 0);
  const totalTax = issued.reduce((a, x) => a + parseFloat(x.inv.taxAmount ?? "0"), 0);

  return (
    <div className="p-8 space-y-6 max-w-[1300px]">
      <PageHeader module="Financeiro" title="Notas Fiscais"
        subtitle="Emissão de NF-e (produto) e NFS-e (serviço). Integrável com SEFAZ / prefeitura." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="NFs emitidas" value={String(issued.length)} Icon={ReceiptText} tint="bg-emerald-50 text-emerald-600" />
        <Kpi label="Faturamento emitido" value={brl(totalIssued)} />
        <Kpi label="Impostos" value={brl(totalTax)} sub="destacados nas NFs" tint="bg-amber-50 text-amber-600" />
      </div>

      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
              <th className="px-5 py-3 font-semibold">Número</th>
              <th className="px-3 py-3 font-semibold">Tipo</th>
              <th className="px-3 py-3 font-semibold">Cliente</th>
              <th className="px-3 py-3 font-semibold text-right">Valor</th>
              <th className="px-3 py-3 font-semibold text-right">Impostos</th>
              <th className="px-3 py-3 font-semibold">Emissão</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map(({ inv, companyName }) => (
              <tr key={inv.id} className="hover:bg-zinc-50/60">
                <td className="px-5 py-3">
                  <div className="font-semibold text-zinc-800 tabular-nums">{inv.kind.toUpperCase()} {inv.number}</div>
                  {inv.accessKey && <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[180px]">{inv.accessKey}</div>}
                </td>
                <td className="px-3 py-3"><Badge tone="blue">{inv.kind === "nfe" ? "NF-e" : "NFS-e"}</Badge></td>
                <td className="px-3 py-3 text-zinc-500 text-[13px]">{companyName ?? "—"}</td>
                <td className="px-3 py-3 text-right font-semibold text-zinc-900 tabular-nums">{brl(inv.amount)}</td>
                <td className="px-3 py-3 text-right text-zinc-500 tabular-nums">{brl(inv.taxAmount)}</td>
                <td className="px-3 py-3 text-zinc-500 text-[13px] tabular-nums">{inv.issuedAt ? dateBR(inv.issuedAt) : "—"}</td>
                <td className="px-5 py-3"><Badge tone={statusTone[inv.status]}>{statusLabel[inv.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="Nenhuma nota fiscal." />}
      </div>
    </div>
  );
}

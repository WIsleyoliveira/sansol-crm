import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Circle, Landmark } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { brl, dateBR } from "@/lib/format";
import { PageHeader, Kpi, Badge, EmptyState, card } from "@/components/ui";
import { reconcileTransaction } from "@/app/actions-finance";

export default async function ConciliacaoPage() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) redirect("/");

  const accounts = await db.select().from(s.financialAccounts).where(eq(s.financialAccounts.workspaceId, user.workspaceId));
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const txs = await db.select().from(s.bankTransactions)
    .where(eq(s.bankTransactions.workspaceId, user.workspaceId))
    .orderBy(desc(s.bankTransactions.date));

  const pending = txs.filter((t) => !t.reconciled);
  const connected = accounts.filter((a) => a.openBankingConnected);

  return (
    <div className="p-8 space-y-6 max-w-[1200px]">
      <PageHeader module="Financeiro · Open Banking" title="Conciliação Bancária"
        subtitle="Extrato sincronizado via Open Banking. Concilie cada lançamento com um título a pagar ou receber." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Contas conectadas" value={String(connected.length)} sub="via Open Banking" Icon={Landmark} tint="bg-violet-50 text-violet-600" />
        <Kpi label="Lançamentos" value={String(txs.length)} sub="últimos 30 dias" />
        <Kpi label="Pendentes de conciliação" value={String(pending.length)} tint="bg-amber-50 text-amber-600" />
      </div>

      <div className="flex flex-wrap gap-2">
        {accounts.map((a) => (
          <div key={a.id} className={`${card} px-4 py-2.5 flex items-center gap-2`}>
            <span className="text-[13px] font-medium text-zinc-700">{a.name}</span>
            {a.openBankingConnected
              ? <Badge tone="green">● Conectada</Badge>
              : <Badge tone="zinc">Manual</Badge>}
          </div>
        ))}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-zinc-100 font-semibold text-sm text-zinc-800">Extrato consolidado</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-50">
            {txs.map((t) => {
              const entrada = parseFloat(t.amount) >= 0;
              const acc = accById.get(t.accountId);
              return (
                <tr key={t.id} className="hover:bg-zinc-50/60">
                  <td className="pl-5 pr-2 py-3 w-10">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${entrada ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      {entrada ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="font-medium text-zinc-800 text-[13px]">{t.description}</div>
                    <div className="text-xs text-zinc-400">{acc?.name} · {dateBR(t.date)}</div>
                  </td>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${entrada ? "text-emerald-700" : "text-red-600"}`}>
                    {entrada ? "+" : ""}{brl(t.amount)}
                  </td>
                  <td className="px-3 py-3">
                    {t.reconciled
                      ? <Badge tone="green">Conciliado{t.matchedType ? ` · ${t.matchedType === "payable" ? "pagar" : "receber"}` : ""}</Badge>
                      : <Badge tone="amber">Pendente</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <form action={reconcileTransaction.bind(null, t.id, "")}>
                      <button className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-1.5 transition-colors ${t.reconciled ? "text-zinc-500 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-700"}`}>
                        {t.reconciled ? <><Circle className="h-3.5 w-3.5" /> Desfazer</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Conciliar</>}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {txs.length === 0 && <EmptyState title="Sem lançamentos importados." hint="Conecte uma conta via Open Banking." />}
      </div>
    </div>
  );
}

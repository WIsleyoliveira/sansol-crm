import { redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { Banknote, TrendingDown, TrendingUp, AlertTriangle, Landmark, ArrowRight } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { brl, dateBR } from "@/lib/format";
import { PageHeader, Kpi, SectionCard, Badge, card } from "@/components/ui";

export default async function FinanceiroPage() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) redirect("/");
  const ws = eq(s.financialAccounts.workspaceId, user.workspaceId);

  const accounts = await db.select().from(s.financialAccounts).where(ws);
  const payables = await db.select().from(s.payables)
    .where(and(eq(s.payables.workspaceId, user.workspaceId), ne(s.payables.status, "paid")))
    .orderBy(asc(s.payables.dueDate));
  const receivables = await db.select().from(s.receivables)
    .where(and(eq(s.receivables.workspaceId, user.workspaceId), ne(s.receivables.status, "received")))
    .orderBy(asc(s.receivables.dueDate));

  const saldoTotal = accounts.reduce((a, x) => a + parseFloat(x.balance), 0);
  const totalPagar = payables.reduce((a, x) => a + parseFloat(x.amount), 0);
  const totalReceber = receivables.reduce((a, x) => a + parseFloat(x.amount), 0);
  const vencidasPagar = payables.filter((p) => p.status === "overdue");
  const vencidasReceber = receivables.filter((r) => r.status === "overdue");

  return (
    <div className="p-8 space-y-6 max-w-[1500px]">
      <PageHeader module="Financeiro · ERP" title="Visão Financeira"
        subtitle="Fluxo de caixa consolidado — contas bancárias, a pagar e a receber. Conciliação via Open Banking." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Saldo em caixa" value={brl(saldoTotal)} sub={`${accounts.length} contas`} Icon={Banknote} tint="bg-emerald-50 text-emerald-600" />
        <Kpi label="A pagar (em aberto)" value={brl(totalPagar)} sub={`${payables.length} títulos`} Icon={TrendingDown} tint="bg-red-50 text-red-600" />
        <Kpi label="A receber (em aberto)" value={brl(totalReceber)} sub={`${receivables.length} títulos`} Icon={TrendingUp} tint="bg-sky-50 text-sky-600" />
        <Kpi label="Projeção 30d" value={brl(saldoTotal + totalReceber - totalPagar)} sub="saldo + receber − pagar" Icon={Landmark} tint="bg-violet-50 text-violet-600" />
      </div>

      {(vencidasPagar.length > 0 || vencidasReceber.length > 0) && (
        <div className={`${card} p-4 flex items-center gap-3 border-l-4 border-l-red-400`}>
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="text-sm text-zinc-700">
            <span className="font-semibold text-red-600">{vencidasPagar.length}</span> conta(s) a pagar vencida(s) ({brl(vencidasPagar.reduce((a, x) => a + parseFloat(x.amount), 0))}) e{" "}
            <span className="font-semibold text-red-600">{vencidasReceber.length}</span> a receber em atraso ({brl(vencidasReceber.reduce((a, x) => a + parseFloat(x.amount), 0))}).
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <SectionCard title="Contas bancárias">
          <div className="divide-y divide-zinc-50">
            {accounts.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-zinc-800">{a.name}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                    {a.openBankingConnected ? <Badge tone="green">Open Banking</Badge> : <Badge tone="zinc">Manual</Badge>}
                  </div>
                </div>
                <div className="text-sm font-semibold text-zinc-900 tabular-nums">{brl(a.balance)}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Próximos a pagar" right={<Link href="/financeiro/pagar" className="text-xs text-amber-600 font-semibold flex items-center gap-1">Ver <ArrowRight className="h-3 w-3" /></Link>}>
          <div className="divide-y divide-zinc-50">
            {payables.slice(0, 6).map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-zinc-800 truncate">{p.description}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{p.supplier ?? "—"} · vence {dateBR(p.dueDate)}</div>
                </div>
                <div className={`text-sm font-semibold tabular-nums ${p.status === "overdue" ? "text-red-600" : "text-zinc-700"}`}>{brl(p.amount)}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Próximos a receber" right={<Link href="/financeiro/receber" className="text-xs text-amber-600 font-semibold flex items-center gap-1">Ver <ArrowRight className="h-3 w-3" /></Link>}>
          <div className="divide-y divide-zinc-50">
            {receivables.slice(0, 6).map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-zinc-800 truncate">{r.description}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">vence {dateBR(r.dueDate)}</div>
                </div>
                <div className={`text-sm font-semibold tabular-nums ${r.status === "overdue" ? "text-red-600" : "text-emerald-700"}`}>{brl(r.amount)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

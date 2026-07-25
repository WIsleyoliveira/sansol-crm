import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { createReceivable } from "@/app/actions-finance";
import { card } from "@/components/ui";

export default async function NovaContaReceberPage() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) redirect("/");

  const accounts = await db.select().from(s.financialAccounts).where(eq(s.financialAccounts.workspaceId, user.workspaceId));
  const companies = await db.select().from(s.companies)
    .where(eq(s.companies.workspaceId, user.workspaceId)).orderBy(asc(s.companies.name));

  const input = "w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
  const label = "block text-xs font-medium text-zinc-500 mb-1";

  return (
    <div className="p-8 max-w-xl">
      <Link href="/financeiro/receber" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-4"><ArrowLeft className="h-4 w-4" /> Contas a Receber</Link>
      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-6">Nova conta a receber</h1>
      <form action={createReceivable} className={`space-y-4 ${card} p-6`}>
        <div>
          <label className={label}>Descrição *</label>
          <input name="description" required placeholder="Ex.: Entrada, parcela 1/3…" className={input} />
        </div>
        <div>
          <label className={label}>Cliente</label>
          <select name="companyId" className={input} defaultValue="">
            <option value="">—</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Valor (R$) *</label>
            <input name="amount" required inputMode="decimal" placeholder="0,00" className={input} />
          </div>
          <div>
            <label className={label}>Vencimento *</label>
            <input name="dueDate" type="date" required className={input} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>Parcela nº</label>
            <input name="installmentNo" type="number" min="1" className={input} />
          </div>
          <div>
            <label className={label}>de</label>
            <input name="installmentTotal" type="number" min="1" className={input} />
          </div>
          <div>
            <label className={label}>Conta de crédito</label>
            <select name="accountId" className={input} defaultValue="">
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <button className="rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-6 py-2.5 hover:bg-zinc-700 shadow-sm transition-colors">
          Lançar recebível
        </button>
      </form>
    </div>
  );
}

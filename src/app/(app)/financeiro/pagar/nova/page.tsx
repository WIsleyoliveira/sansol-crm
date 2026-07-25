import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { createPayable } from "@/app/actions-finance";
import { card } from "@/components/ui";

export default async function NovaContaPagarPage() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) redirect("/");

  const accounts = await db.select().from(s.financialAccounts).where(eq(s.financialAccounts.workspaceId, user.workspaceId));

  const input = "w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
  const label = "block text-xs font-medium text-zinc-500 mb-1";

  return (
    <div className="p-8 max-w-xl">
      <Link href="/financeiro/pagar" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-4"><ArrowLeft className="h-4 w-4" /> Contas a Pagar</Link>
      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-6">Nova conta a pagar</h1>
      <form action={createPayable} className={`space-y-4 ${card} p-6`}>
        <div>
          <label className={label}>Descrição *</label>
          <input name="description" required placeholder="Ex.: Lote de painéis, folha, aluguel…" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Fornecedor</label>
            <input name="supplier" className={input} />
          </div>
          <div>
            <label className={label}>Categoria</label>
            <select name="category" className={input} defaultValue="other">
              <option value="equipment">Equipamentos</option>
              <option value="payroll">Folha</option>
              <option value="tax">Impostos</option>
              <option value="rent">Aluguel</option>
              <option value="marketing">Marketing</option>
              <option value="logistics">Logística</option>
              <option value="other">Outros</option>
            </select>
          </div>
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
        <div>
          <label className={label}>Conta de débito</label>
          <select name="accountId" className={input} defaultValue="">
            <option value="">—</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button className="rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-6 py-2.5 hover:bg-zinc-700 shadow-sm transition-colors">
          Lançar conta
        </button>
      </form>
    </div>
  );
}

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { createOpportunity } from "@/app/actions-create";

export default async function NovaOportunidadePage() {
  const user = await requireUser();
  if (!can(user.role, "manage_records")) redirect("/projetos");

  const companies = await db.select().from(s.companies)
    .where(eq(s.companies.workspaceId, user.workspaceId));

  const input = "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400";
  const label = "block text-xs font-medium text-zinc-500 mb-1";

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold text-zinc-900 mb-5">Nova oportunidade</h1>
      <form action={createOpportunity} className="space-y-4 rounded-xl bg-white border border-zinc-200 p-5">
        <div>
          <label className={label}>Nome do negócio *</label>
          <input name="name" required placeholder="Ex.: Mercado Central — 40 kWp" className={input} />
        </div>
        <div>
          <label className={label}>Empresa *</label>
          <select name="companyId" required className={input}>
            <option value="">Selecione…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Valor estimado (R$)</label>
            <input name="amount" type="number" step="0.01" min="0" placeholder="150000" className={input} />
          </div>
          <div>
            <label className={label}>Potência estimada (kWp)</label>
            <input name="systemSizeKwp" type="number" step="0.01" min="0" placeholder="40" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Origem do lead</label>
            <select name="leadSource" className={input}>
              <option value="">—</option>
              <option>Indicação</option>
              <option>Site</option>
              <option>Tráfego pago</option>
              <option>Feira agro</option>
              <option>Base</option>
            </select>
          </div>
          <div>
            <label className={label}>Fechamento esperado</label>
            <input name="expectedCloseDate" type="date" className={input} />
          </div>
        </div>
        <button className="rounded-lg bg-zinc-900 text-white text-sm px-5 py-2.5 hover:bg-zinc-700">
          Criar oportunidade
        </button>
      </form>
    </div>
  );
}

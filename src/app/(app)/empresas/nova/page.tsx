import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";
import { createCompany } from "@/app/actions-create";

export default async function NovaEmpresaPage() {
  const user = await requireUser();
  if (!can(user.role, "manage_records")) redirect("/projetos");

  const input = "w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
  const label = "block text-xs font-medium text-zinc-500 mb-1";
  const section = "text-sm font-semibold text-zinc-700 pt-2";

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-6">Nova empresa</h1>
      <form action={createCompany} className="space-y-4 rounded-2xl bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.12)] p-6">
        <div>
          <label className={label}>Nome da empresa *</label>
          <input name="name" required className={input} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Setor</label>
            <input name="industry" placeholder="Varejo, Agro, Saúde…" className={input} />
          </div>
          <div>
            <label className={label}>Porte</label>
            <select name="size" className={input}>
              <option value="">—</option>
              <option>1-10</option><option>11-50</option><option>51-200</option><option>201-500</option><option>500+</option>
            </select>
          </div>
        </div>

        <div className={section}>Contato principal</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Nome</label>
            <input name="contactName" className={input} />
          </div>
          <div>
            <label className={label}>Cargo</label>
            <input name="contactTitle" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Telefone</label>
            <input name="contactPhone" className={input} />
          </div>
          <div>
            <label className={label}>E-mail</label>
            <input name="contactEmail" type="email" className={input} />
          </div>
        </div>

        <div className={section}>Local da instalação</div>
        <div>
          <label className={label}>Endereço</label>
          <input name="siteAddress" className={input} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>Cidade</label>
            <input name="siteCity" className={input} />
          </div>
          <div>
            <label className={label}>UF</label>
            <input name="siteState" defaultValue="SC" maxLength={2} className={input} />
          </div>
          <div>
            <label className={label}>Consumo (kWh/mês)</label>
            <input name="siteConsumption" type="number" min="0" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Tipo de telhado</label>
          <select name="siteRoofType" className={input}>
            <option value="">—</option>
            <option>Cerâmico</option><option>Metálico</option><option>Fibrocimento</option><option>Laje</option><option>Solo (usina)</option>
          </select>
        </div>

        <button className="rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-6 py-2.5 hover:bg-zinc-700 shadow-sm transition-colors">
          Criar empresa
        </button>
      </form>
    </div>
  );
}

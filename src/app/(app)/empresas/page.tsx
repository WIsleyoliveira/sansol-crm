import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Building2, Plus } from "lucide-react";
import { can } from "@/lib/policy";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export default async function EmpresasPage() {
  const user = await requireUser();
  if (!can(user.role, "view_pipeline")) redirect("/projetos");
  const rows = await db.select({
    company: s.companies,
    ownerName: s.users.name,
  }).from(s.companies)
    .leftJoin(s.users, eq(s.users.id, s.companies.ownerId))
    .where(eq(s.companies.workspaceId, user.workspaceId))
    .orderBy(desc(s.companies.createdAt));

  return (
    <div className="p-8 max-w-[1100px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Empresas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{rows.length} contas na base</p>
        </div>
        <Link href="/empresas/nova"
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 text-white text-[13px] font-semibold px-4 py-2.5 hover:bg-zinc-700 shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> Nova empresa
        </Link>
      </div>
      <div className="rounded-2xl bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.12)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/80 text-left text-[11px] uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Empresa</th>
              <th className="px-5 py-3.5 font-semibold">Setor</th>
              <th className="px-5 py-3.5 font-semibold">Porte</th>
              <th className="px-5 py-3.5 font-semibold">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map((r) => (
              <tr key={r.company.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-zinc-400" />
                    </div>
                    <span className="font-semibold text-zinc-900">{r.company.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-zinc-500">{r.company.industry ?? "—"}</td>
                <td className="px-5 py-3.5 text-zinc-500">{r.company.size ?? "—"}</td>
                <td className="px-5 py-3.5 text-zinc-500">{r.ownerName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

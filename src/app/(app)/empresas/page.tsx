import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export default async function EmpresasPage() {
  const user = await requireUser();
  const rows = await db.select({
    company: s.companies,
    ownerName: s.users.name,
  }).from(s.companies)
    .leftJoin(s.users, eq(s.users.id, s.companies.ownerId))
    .where(eq(s.companies.workspaceId, user.workspaceId))
    .orderBy(desc(s.companies.createdAt));

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-zinc-900 mb-1">Empresas</h1>
      <p className="text-sm text-zinc-500 mb-5">{rows.length} contas na base</p>
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Setor</th>
              <th className="px-4 py-3">Porte</th>
              <th className="px-4 py-3">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.company.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-medium text-zinc-900">{r.company.name}</td>
                <td className="px-4 py-3 text-zinc-600">{r.company.industry ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{r.company.size ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{r.ownerName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

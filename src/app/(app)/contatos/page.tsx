import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export default async function ContatosPage() {
  const user = await requireUser();
  const rows = await db.select({
    contact: s.contacts,
    companyName: s.companies.name,
  }).from(s.contacts)
    .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
    .where(eq(s.contacts.workspaceId, user.workspaceId))
    .orderBy(desc(s.contacts.createdAt));

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-zinc-900 mb-1">Contatos</h1>
      <p className="text-sm text-zinc-500 mb-5">{rows.length} pessoas na base</p>
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">E-mail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.contact.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-medium text-zinc-900">{r.contact.name}</td>
                <td className="px-4 py-3 text-zinc-600">{r.contact.title ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{r.companyName ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{r.contact.phone ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{r.contact.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

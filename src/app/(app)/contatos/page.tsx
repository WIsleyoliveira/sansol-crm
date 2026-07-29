import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { can } from "@/lib/policy";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export default async function ContatosPage() {
  const user = await requireUser();
  if (!can(user.role, "view_pipeline")) redirect("/projetos");
  const rows = await db.select({
    contact: s.contacts,
    companyName: s.companies.name,
  }).from(s.contacts)
    .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
    .where(eq(s.contacts.workspaceId, user.workspaceId))
    .orderBy(desc(s.contacts.createdAt));

  return (
    <div className="p-8 max-w-[1100px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Contatos</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{rows.length} pessoas na base</p>
      </div>
      <div className="rounded-2xl bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.12)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/80 text-left text-[11px] uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Nome</th>
              <th className="px-5 py-3.5 font-semibold">Cargo</th>
              <th className="px-5 py-3.5 font-semibold">Empresa</th>
              <th className="px-5 py-3.5 font-semibold">Telefone</th>
              <th className="px-5 py-3.5 font-semibold">E-mail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map((r) => (
              <tr key={r.contact.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-zinc-800 text-white text-[10px] font-bold flex items-center justify-center">
                      {r.contact.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <span className="font-semibold text-zinc-900">{r.contact.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-zinc-500">{r.contact.title ?? "—"}</td>
                <td className="px-5 py-3.5 text-zinc-500">{r.companyName ?? "—"}</td>
                <td className="px-5 py-3.5 text-zinc-500 tabular-nums">{r.contact.phone ?? "—"}</td>
                <td className="px-5 py-3.5 text-zinc-500">{r.contact.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

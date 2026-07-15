import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { moveInstallationStage } from "@/app/actions";
import { Kanban, type KanbanColumn } from "@/components/Kanban";
import { daysSince, kwp } from "@/lib/format";

export default async function ProjetosPage() {
  const user = await requireUser();

  const [pipe] = await db.select().from(s.pipelines)
    .where(and(eq(s.pipelines.workspaceId, user.workspaceId), eq(s.pipelines.kind, "installation")));

  const stages = await db.select().from(s.pipelineStages)
    .where(eq(s.pipelineStages.pipelineId, pipe.id)).orderBy(asc(s.pipelineStages.order));

  const projects = await db
    .select({
      proj: s.installationProjects,
      oppName: s.opportunities.name,
      oppId: s.opportunities.id,
      systemSizeKwp: s.opportunities.systemSizeKwp,
      companyName: s.companies.name,
      city: s.sites.city,
      installerName: s.users.name,
    })
    .from(s.installationProjects)
    .innerJoin(s.opportunities, eq(s.opportunities.id, s.installationProjects.opportunityId))
    .leftJoin(s.companies, eq(s.companies.id, s.opportunities.companyId))
    .leftJoin(s.sites, eq(s.sites.id, s.installationProjects.siteId))
    .leftJoin(s.users, eq(s.users.id, s.installationProjects.installerId))
    .where(eq(s.installationProjects.workspaceId, user.workspaceId));

  const columns: KanbanColumn[] = stages.map((st) => ({
    id: st.id,
    name: st.name,
    isTerminal: st.isWon,
    cards: projects
      .filter((p) => p.proj.stageId === st.id)
      .map((p) => ({
        id: p.proj.id,
        href: `/oportunidades/${p.oppId}`,
        title: p.companyName ?? p.oppName,
        subtitle: [p.city, p.installerName ? `Téc: ${p.installerName.split(" ")[0]}` : null].filter(Boolean).join(" · "),
        badge: p.systemSizeKwp ? kwp(p.systemSizeKwp) : undefined,
        daysInStage: daysSince(p.proj.stageEnteredAt),
        slaDays: st.slaDays,
      })),
  }));

  async function move(cardId: string, toColumnId: string) {
    "use server";
    await moveInstallationStage(cardId, toColumnId);
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Projetos / Instalação</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Pós-venda: da homologação na concessionária até o sistema ligado. Borda vermelha indica prazo estourado.
        </p>
      </div>
      <Kanban columns={columns} moveAction={move} />
    </div>
  );
}

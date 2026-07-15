"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export async function loginAs(userId: string) {
  const store = await cookies();
  store.set("sansol_uid", userId, { httpOnly: true, path: "/" });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete("sansol_uid");
  redirect("/login");
}

export async function moveOpportunityStage(opportunityId: string, toStageId: string) {
  const user = await requireUser();

  const [opp] = await db.select().from(s.opportunities)
    .where(and(eq(s.opportunities.id, opportunityId), eq(s.opportunities.workspaceId, user.workspaceId)));
  if (!opp || opp.stageId === toStageId) return;

  const [toStage] = await db.select().from(s.pipelineStages).where(eq(s.pipelineStages.id, toStageId));
  if (!toStage) return;

  const timeInStage = Math.floor((Date.now() - new Date(opp.stageEnteredAt).getTime()) / 1000);
  const status = toStage.isWon ? "won" : toStage.isLost ? "lost" : "open";

  await db.update(s.opportunities).set({
    stageId: toStageId,
    status,
    closedAt: status === "open" ? null : new Date(),
    stageEnteredAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(s.opportunities.id, opportunityId));

  await db.insert(s.opportunityStageHistory).values({
    opportunityId, fromStageId: opp.stageId, toStageId,
    changedBy: user.id, timeInStageSeconds: timeInStage,
  });

  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "opportunity", relatedToId: opportunityId,
    type: "stage_changed", payload: { to: toStage.name },
  });

  // Workflow: ganhou → cria projeto de instalação automaticamente
  if (toStage.isWon) {
    const [instPipe] = await db.select().from(s.pipelines)
      .where(and(eq(s.pipelines.workspaceId, user.workspaceId), eq(s.pipelines.kind, "installation")));
    if (instPipe) {
      const [firstStage] = await db.select().from(s.pipelineStages)
        .where(and(eq(s.pipelineStages.pipelineId, instPipe.id), eq(s.pipelineStages.order, 1)));
      const existing = await db.select().from(s.installationProjects)
        .where(eq(s.installationProjects.opportunityId, opportunityId));
      if (firstStage && existing.length === 0) {
        const [site] = await db.select().from(s.sites)
          .where(and(eq(s.sites.workspaceId, user.workspaceId), eq(s.sites.companyId, opp.companyId!)));
        await db.insert(s.installationProjects).values({
          workspaceId: user.workspaceId, opportunityId, siteId: site?.id,
          stageId: firstStage.id,
        });
        await db.insert(s.activities).values({
          workspaceId: user.workspaceId, actorId: null, actorType: "system",
          relatedToType: "opportunity", relatedToId: opportunityId,
          type: "project_created", payload: { text: "Projeto de instalação criado automaticamente (workflow: oportunidade ganha)." },
        });
      }
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/projetos");
  revalidatePath(`/oportunidades/${opportunityId}`);
}

export async function moveInstallationStage(projectId: string, toStageId: string) {
  const user = await requireUser();
  const [proj] = await db.select().from(s.installationProjects)
    .where(and(eq(s.installationProjects.id, projectId), eq(s.installationProjects.workspaceId, user.workspaceId)));
  if (!proj || proj.stageId === toStageId) return;

  const [toStage] = await db.select().from(s.pipelineStages).where(eq(s.pipelineStages.id, toStageId));
  if (!toStage) return;

  await db.update(s.installationProjects).set({
    stageId: toStageId,
    stageEnteredAt: new Date(),
    installationCompletedAt: toStage.isWon ? new Date() : proj.installationCompletedAt,
    warrantyStartDate: toStage.isWon ? new Date() : proj.warrantyStartDate,
  }).where(eq(s.installationProjects.id, projectId));

  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "opportunity", relatedToId: proj.opportunityId,
    type: "installation_stage_changed", payload: { to: toStage.name },
  });

  revalidatePath("/projetos");
  revalidatePath(`/oportunidades/${proj.opportunityId}`);
}

export async function addNote(opportunityId: string, text: string) {
  const user = await requireUser();
  if (!text.trim()) return;
  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "opportunity", relatedToId: opportunityId,
    type: "note", payload: { text: text.trim() },
  });
  revalidatePath(`/oportunidades/${opportunityId}`);
}

export async function toggleTask(taskId: string) {
  const user = await requireUser();
  const [task] = await db.select().from(s.tasks)
    .where(and(eq(s.tasks.id, taskId), eq(s.tasks.workspaceId, user.workspaceId)));
  if (!task) return;
  await db.update(s.tasks).set({
    completedAt: task.completedAt ? null : new Date(),
  }).where(eq(s.tasks.id, taskId));
  revalidatePath("/tarefas");
  revalidatePath("/");
}

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const opportunityId = String(formData.get("opportunityId") ?? "") || null;
  const dueAt = String(formData.get("dueAt") ?? "");
  await db.insert(s.tasks).values({
    workspaceId: user.workspaceId,
    relatedToType: opportunityId ? "opportunity" : null,
    relatedToId: opportunityId,
    assigneeId: user.id, createdBy: user.id,
    type: (String(formData.get("type") ?? "todo") as "call" | "email" | "meeting" | "visit" | "todo"),
    title,
    dueAt: dueAt ? new Date(dueAt) : null,
  });
  revalidatePath("/tarefas");
  if (opportunityId) revalidatePath(`/oportunidades/${opportunityId}`);
}

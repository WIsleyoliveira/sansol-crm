"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";

export async function createCompany(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "manage_records")) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const [company] = await db.insert(s.companies).values({
    workspaceId: user.workspaceId,
    name,
    industry: String(formData.get("industry") ?? "") || null,
    size: String(formData.get("size") ?? "") || null,
    ownerId: user.id,
  }).returning();

  const contactName = String(formData.get("contactName") ?? "").trim();
  if (contactName) {
    await db.insert(s.contacts).values({
      workspaceId: user.workspaceId,
      companyId: company.id,
      name: contactName,
      email: String(formData.get("contactEmail") ?? "") || null,
      phone: String(formData.get("contactPhone") ?? "") || null,
      title: String(formData.get("contactTitle") ?? "") || null,
      ownerId: user.id,
    });
  }

  const address = String(formData.get("siteAddress") ?? "").trim();
  if (address) {
    const consumption = parseInt(String(formData.get("siteConsumption") ?? ""), 10);
    await db.insert(s.sites).values({
      workspaceId: user.workspaceId,
      companyId: company.id,
      address,
      city: String(formData.get("siteCity") ?? "") || null,
      state: String(formData.get("siteState") ?? "") || "SC",
      roofType: String(formData.get("siteRoofType") ?? "") || null,
      utilityCompany: "CELESC",
      tariffClass: "B3",
      avgMonthlyConsumptionKwh: Number.isNaN(consumption) ? null : consumption,
    });
  }

  revalidatePath("/empresas");
  redirect("/empresas");
}

export async function createOpportunity(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "manage_records")) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "");
  if (!name || !companyId) return;

  const [pipe] = await db.select().from(s.pipelines)
    .where(and(eq(s.pipelines.workspaceId, user.workspaceId), eq(s.pipelines.kind, "sales")));
  const [firstStage] = await db.select().from(s.pipelineStages)
    .where(eq(s.pipelineStages.pipelineId, pipe.id)).orderBy(asc(s.pipelineStages.order)).limit(1);

  const [contact] = await db.select().from(s.contacts)
    .where(and(eq(s.contacts.workspaceId, user.workspaceId), eq(s.contacts.companyId, companyId)))
    .limit(1);

  const amount = String(formData.get("amount") ?? "").replace(",", ".");
  const kwp = String(formData.get("systemSizeKwp") ?? "").replace(",", ".");
  const closeDate = String(formData.get("expectedCloseDate") ?? "");

  const [opp] = await db.insert(s.opportunities).values({
    workspaceId: user.workspaceId,
    pipelineId: pipe.id,
    stageId: firstStage.id,
    companyId,
    primaryContactId: contact?.id,
    ownerId: user.id,
    name,
    amount: amount || null,
    systemSizeKwp: kwp || null,
    leadSource: String(formData.get("leadSource") ?? "") || null,
    expectedCloseDate: closeDate ? new Date(closeDate) : null,
  }).returning();

  await db.insert(s.opportunityStageHistory).values({
    opportunityId: opp.id, fromStageId: null, toStageId: firstStage.id, changedBy: user.id,
  });
  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "opportunity", relatedToId: opp.id,
    type: "note", payload: { text: "Oportunidade criada." },
  });

  revalidatePath("/pipeline");
  redirect(`/oportunidades/${opp.id}`);
}

export async function createProposal(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "manage_records")) throw new Error("FORBIDDEN");

  const opportunityId = String(formData.get("opportunityId") ?? "");
  const kwp = String(formData.get("systemSizeKwp") ?? "").replace(",", ".");
  const totalPrice = String(formData.get("totalPrice") ?? "").replace(",", ".");
  if (!opportunityId || !kwp || !totalPrice) return;

  const [last] = await db.select().from(s.proposals)
    .where(eq(s.proposals.opportunityId, opportunityId))
    .orderBy(desc(s.proposals.version)).limit(1);

  const panelQty = parseInt(String(formData.get("panelQty") ?? ""), 10);
  const financingType = String(formData.get("financingType") ?? "cash") as "cash" | "financing" | "leasing";
  const installments = parseInt(String(formData.get("installments") ?? ""), 10);

  await db.insert(s.proposals).values({
    workspaceId: user.workspaceId,
    opportunityId,
    version: (last?.version ?? 0) + 1,
    systemSizeKwp: kwp,
    panelModel: String(formData.get("panelModel") ?? "") || null,
    panelQty: Number.isNaN(panelQty) ? null : panelQty,
    inverterModel: String(formData.get("inverterModel") ?? "") || null,
    estimatedGenerationKwhMonth: Math.round(parseFloat(kwp) * 118),
    paybackYears: String(formData.get("paybackYears") ?? "").replace(",", ".") || null,
    totalPrice,
    financingType,
    installments: financingType === "financing" && !Number.isNaN(installments) ? installments : null,
    status: "draft",
  });

  await db.insert(s.activities).values({
    workspaceId: user.workspaceId, actorId: user.id, actorType: "user",
    relatedToType: "opportunity", relatedToId: opportunityId,
    type: "note", payload: { text: `Nova proposta criada (v${(last?.version ?? 0) + 1}, ${kwp} kWp).` },
  });

  revalidatePath(`/oportunidades/${opportunityId}`);
}

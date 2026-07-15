import {
  pgTable, uuid, text, timestamp, integer, boolean, numeric, jsonb, uniqueIndex, index,
} from "drizzle-orm/pg-core";

// ─── Tenancy ────────────────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("trial"),
  status: text("status").notNull().default("active"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["owner", "admin", "manager", "rep", "installer", "viewer"] }).notNull(),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("uq_member").on(t.workspaceId, t.userId)]);

// ─── CRM core ───────────────────────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  size: text("size"),
  ownerId: uuid("owner_id").references(() => users.id),
  customFields: jsonb("custom_fields").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [index("ix_companies_ws").on(t.workspaceId)]);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  companyId: uuid("company_id").references(() => companies.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  ownerId: uuid("owner_id").references(() => users.id),
  customFields: jsonb("custom_fields").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [index("ix_contacts_ws").on(t.workspaceId)]);

// ─── Pipelines ──────────────────────────────────────────────────────────────

export const pipelines = pgTable("pipelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["sales", "installation"] }).notNull().default("sales"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").notNull().references(() => pipelines.id),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  probability: integer("probability").notNull().default(0),
  isWon: boolean("is_won").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
  slaDays: integer("sla_days"),
}, (t) => [uniqueIndex("uq_stage_order").on(t.pipelineId, t.order)]);

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  pipelineId: uuid("pipeline_id").notNull().references(() => pipelines.id),
  stageId: uuid("stage_id").notNull().references(() => pipelineStages.id),
  companyId: uuid("company_id").references(() => companies.id),
  primaryContactId: uuid("primary_contact_id").references(() => contacts.id),
  ownerId: uuid("owner_id").references(() => users.id),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  systemSizeKwp: numeric("system_size_kwp", { precision: 8, scale: 2 }),
  leadSource: text("lead_source"),
  expectedCloseDate: timestamp("expected_close_date"),
  closedAt: timestamp("closed_at"),
  status: text("status", { enum: ["open", "won", "lost"] }).notNull().default("open"),
  lostReason: text("lost_reason"),
  stageEnteredAt: timestamp("stage_entered_at").notNull().defaultNow(),
  customFields: jsonb("custom_fields").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("ix_opps_ws").on(t.workspaceId), index("ix_opps_stage").on(t.stageId)]);

export const opportunityStageHistory = pgTable("opportunity_stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  fromStageId: uuid("from_stage_id").references(() => pipelineStages.id),
  toStageId: uuid("to_stage_id").notNull().references(() => pipelineStages.id),
  changedBy: uuid("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  timeInStageSeconds: integer("time_in_stage_seconds"),
});

// ─── Tasks & activities ─────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  relatedToType: text("related_to_type", { enum: ["company", "contact", "opportunity", "installation_project"] }),
  relatedToId: uuid("related_to_id"),
  assigneeId: uuid("assignee_id").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdByAgent: boolean("created_by_agent").notNull().default(false),
  type: text("type", { enum: ["call", "email", "meeting", "visit", "todo"] }).notNull().default("todo"),
  title: text("title").notNull(),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("ix_tasks_ws").on(t.workspaceId)]);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  actorId: uuid("actor_id").references(() => users.id),
  actorType: text("actor_type", { enum: ["user", "system", "ai_agent"] }).notNull().default("user"),
  relatedToType: text("related_to_type").notNull(),
  relatedToId: uuid("related_to_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("ix_activities_rel").on(t.relatedToType, t.relatedToId)]);

// ─── Solar vertical ─────────────────────────────────────────────────────────

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  companyId: uuid("company_id").references(() => companies.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  address: text("address").notNull(),
  city: text("city"),
  state: text("state"),
  roofType: text("roof_type"),
  roofAreaM2: numeric("roof_area_m2", { precision: 8, scale: 1 }),
  utilityCompany: text("utility_company"),
  tariffClass: text("tariff_class"),
  avgMonthlyConsumptionKwh: integer("avg_monthly_consumption_kwh"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const siteSurveys = pgTable("site_surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  siteId: uuid("site_id").notNull().references(() => sites.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  surveyorId: uuid("surveyor_id").references(() => users.id),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  technicalFeasibility: text("technical_feasibility", { enum: ["pending", "viable", "not_viable", "needs_reinforcement"] }).notNull().default("pending"),
  structuralNotes: text("structural_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  version: integer("version").notNull().default(1),
  systemSizeKwp: numeric("system_size_kwp", { precision: 8, scale: 2 }).notNull(),
  panelModel: text("panel_model"),
  panelQty: integer("panel_qty"),
  inverterModel: text("inverter_model"),
  estimatedGenerationKwhMonth: integer("estimated_generation_kwh_month"),
  paybackYears: numeric("payback_years", { precision: 4, scale: 1 }),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  financingType: text("financing_type", { enum: ["cash", "financing", "leasing"] }).notNull().default("cash"),
  installments: integer("installments"),
  status: text("status", { enum: ["draft", "sent", "accepted", "rejected"] }).notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const installationProjects = pgTable("installation_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id).unique(),
  siteId: uuid("site_id").references(() => sites.id),
  projectManagerId: uuid("project_manager_id").references(() => users.id),
  installerId: uuid("installer_id").references(() => users.id),
  stageId: uuid("stage_id").notNull().references(() => pipelineStages.id),
  permitStatus: text("permit_status", { enum: ["pending", "submitted", "approved"] }).notNull().default("pending"),
  utilityApprovalStatus: text("utility_approval_status", { enum: ["pending", "submitted", "approved"] }).notNull().default("pending"),
  installationScheduledAt: timestamp("installation_scheduled_at"),
  installationCompletedAt: timestamp("installation_completed_at"),
  warrantyStartDate: timestamp("warranty_start_date"),
  stageEnteredAt: timestamp("stage_entered_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const equipmentCatalog = pgTable("equipment_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  type: text("type", { enum: ["panel", "inverter", "battery", "structure"] }).notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model").notNull(),
  specs: jsonb("specs").notNull().default({}),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
});

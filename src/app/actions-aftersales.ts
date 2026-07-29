"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export async function setTicketStatus(ticketId: string, status: "open" | "in_progress" | "resolved") {
  const user = await requireUser();
  const [t] = await db.select().from(s.tickets)
    .where(and(eq(s.tickets.id, ticketId), eq(s.tickets.workspaceId, user.workspaceId)));
  if (!t) return;
  await db.update(s.tickets).set({
    status,
    resolvedAt: status === "resolved" ? new Date() : null,
    assignedTo: t.assignedTo ?? user.id,
  }).where(eq(s.tickets.id, ticketId));
  revalidatePath("/pos-vendas/chamados");
}

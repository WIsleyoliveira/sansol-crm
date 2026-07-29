"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/policy";

async function requireFinance() {
  const user = await requireUser();
  if (!can(user.role, "view_financials")) throw new Error("FORBIDDEN");
  return user;
}

const payableCategories = ["equipment", "payroll", "tax", "rent", "marketing", "logistics", "other"] as const;
type PayableCategory = (typeof payableCategories)[number];

export async function createPayable(formData: FormData) {
  const user = await requireFinance();
  const description = String(formData.get("description") ?? "").trim();
  const amount = String(formData.get("amount") ?? "").replace(/\./g, "").replace(",", ".");
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!description || !amount || !dueDate) return;

  const catRaw = String(formData.get("category") ?? "other");
  const category: PayableCategory = payableCategories.includes(catRaw as PayableCategory) ? (catRaw as PayableCategory) : "other";
  const overdue = new Date(dueDate) < new Date(new Date().toDateString());

  await db.insert(s.payables).values({
    workspaceId: user.workspaceId,
    accountId: String(formData.get("accountId") ?? "") || null,
    description,
    supplier: String(formData.get("supplier") ?? "").trim() || null,
    category,
    amount: parseFloat(amount).toFixed(2),
    dueDate: new Date(dueDate),
    status: overdue ? "overdue" : "open",
  });

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/pagar");
  redirect("/financeiro/pagar");
}

export async function createReceivable(formData: FormData) {
  const user = await requireFinance();
  const description = String(formData.get("description") ?? "").trim();
  const amount = String(formData.get("amount") ?? "").replace(/\./g, "").replace(",", ".");
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!description || !amount || !dueDate) return;

  const instNo = parseInt(String(formData.get("installmentNo") ?? ""), 10);
  const instTotal = parseInt(String(formData.get("installmentTotal") ?? ""), 10);
  const overdue = new Date(dueDate) < new Date(new Date().toDateString());

  await db.insert(s.receivables).values({
    workspaceId: user.workspaceId,
    accountId: String(formData.get("accountId") ?? "") || null,
    companyId: String(formData.get("companyId") ?? "") || null,
    description,
    amount: parseFloat(amount).toFixed(2),
    installmentNo: Number.isNaN(instNo) ? null : instNo,
    installmentTotal: Number.isNaN(instTotal) ? null : instTotal,
    dueDate: new Date(dueDate),
    status: overdue ? "overdue" : "open",
  });

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/receber");
  redirect("/financeiro/receber");
}

export async function markPayablePaid(payableId: string) {
  const user = await requireFinance();
  const [p] = await db.select().from(s.payables)
    .where(and(eq(s.payables.id, payableId), eq(s.payables.workspaceId, user.workspaceId)));
  if (!p || p.status === "paid") return;
  await db.update(s.payables).set({ status: "paid", paidAt: new Date() }).where(eq(s.payables.id, payableId));
  if (p.accountId) {
    const [acc] = await db.select().from(s.financialAccounts).where(eq(s.financialAccounts.id, p.accountId));
    if (acc) await db.update(s.financialAccounts).set({ balance: (parseFloat(acc.balance) - parseFloat(p.amount)).toFixed(2) }).where(eq(s.financialAccounts.id, acc.id));
  }
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/pagar");
}

export async function markReceivableReceived(receivableId: string) {
  const user = await requireFinance();
  const [r] = await db.select().from(s.receivables)
    .where(and(eq(s.receivables.id, receivableId), eq(s.receivables.workspaceId, user.workspaceId)));
  if (!r || r.status === "received") return;
  await db.update(s.receivables).set({ status: "received", receivedAt: new Date() }).where(eq(s.receivables.id, receivableId));
  if (r.accountId) {
    const [acc] = await db.select().from(s.financialAccounts).where(eq(s.financialAccounts.id, r.accountId));
    if (acc) await db.update(s.financialAccounts).set({ balance: (parseFloat(acc.balance) + parseFloat(r.amount)).toFixed(2) }).where(eq(s.financialAccounts.id, acc.id));
  }
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/receber");
}

export async function reconcileTransaction(txId: string, matchType: "payable" | "receivable" | "") {
  const user = await requireFinance();
  const [tx] = await db.select().from(s.bankTransactions)
    .where(and(eq(s.bankTransactions.id, txId), eq(s.bankTransactions.workspaceId, user.workspaceId)));
  if (!tx) return;
  await db.update(s.bankTransactions).set({
    reconciled: !tx.reconciled,
    matchedType: !tx.reconciled ? (matchType || (parseFloat(tx.amount) >= 0 ? "receivable" : "payable")) : null,
  }).where(eq(s.bankTransactions.id, txId));
  revalidatePath("/financeiro/conciliacao");
}

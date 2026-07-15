import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const userId = store.get("sansol_uid")?.value;
  if (!userId) return null;

  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const rows = await db
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      role: s.workspaceMembers.role,
      workspaceId: s.workspaceMembers.workspaceId,
      workspaceName: s.workspaces.name,
    })
    .from(s.users)
    .innerJoin(s.workspaceMembers, eq(s.workspaceMembers.userId, s.users.id))
    .innerJoin(s.workspaces, eq(s.workspaces.id, s.workspaceMembers.workspaceId))
    .where(eq(s.users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

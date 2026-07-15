import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { createTask, toggleTask } from "@/app/actions";
import { relTime } from "@/lib/format";

export default async function TarefasPage() {
  const user = await requireUser();

  const rows = await db.select({
    task: s.tasks,
    assigneeName: s.users.name,
  }).from(s.tasks)
    .leftJoin(s.users, eq(s.users.id, s.tasks.assigneeId))
    .where(eq(s.tasks.workspaceId, user.workspaceId))
    .orderBy(asc(s.tasks.dueAt));

  const open = rows.filter((r) => !r.task.completedAt);
  const done = rows.filter((r) => r.task.completedAt);

  const typeIcon: Record<string, string> = { call: "📞", email: "✉️", meeting: "🤝", visit: "🚗", todo: "☑️" };

  function TaskRow({ r }: { r: (typeof rows)[number] }) {
    const overdue = !r.task.completedAt && r.task.dueAt && new Date(r.task.dueAt) < new Date();
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <form action={toggleTask.bind(null, r.task.id)}>
          <button className={`h-5 w-5 rounded border flex items-center justify-center text-[10px] transition ${
            r.task.completedAt ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 hover:border-emerald-400"
          }`}>{r.task.completedAt ? "✓" : ""}</button>
        </form>
        <span>{typeIcon[r.task.type]}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${r.task.completedAt ? "line-through text-zinc-400" : "text-zinc-800"}`}>
            {r.task.createdByAgent && <span className="text-[10px] rounded bg-violet-100 text-violet-700 px-1 py-0.5 mr-1.5 font-semibold">IA</span>}
            {r.task.title}
          </div>
          <div className="text-xs text-zinc-400">{r.assigneeName}</div>
        </div>
        <div className={`text-xs ${overdue ? "text-red-600 font-semibold" : "text-zinc-400"}`}>
          {r.task.dueAt ? relTime(r.task.dueAt) : ""}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-zinc-900 mb-1">Tarefas</h1>
      <p className="text-sm text-zinc-500 mb-5">{open.length} abertas · {done.length} concluídas</p>

      <form action={createTask} className="flex gap-2 mb-5">
        <select name="type" className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm">
          <option value="todo">☑️</option>
          <option value="call">📞</option>
          <option value="email">✉️</option>
          <option value="meeting">🤝</option>
          <option value="visit">🚗</option>
        </select>
        <input name="title" required placeholder="Nova tarefa…"
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
        <input name="dueAt" type="date" className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm" />
        <button className="rounded-lg bg-zinc-900 text-white text-sm px-4 hover:bg-zinc-700">Criar</button>
      </form>

      <div className="rounded-xl bg-white border border-zinc-200 divide-y divide-zinc-100">
        {open.map((r) => <TaskRow key={r.task.id} r={r} />)}
        {open.length === 0 && <div className="px-4 py-8 text-center text-sm text-zinc-400">Tudo em dia 🎉</div>}
      </div>

      {done.length > 0 && (
        <div className="mt-5 rounded-xl bg-white border border-zinc-200 divide-y divide-zinc-100 opacity-70">
          {done.map((r) => <TaskRow key={r.task.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

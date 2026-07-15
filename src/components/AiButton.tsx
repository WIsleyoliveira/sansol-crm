"use client";

import { useState, useTransition } from "react";
import type { AiResult } from "@/app/actions-ai";

export function AiButton({
  action,
  label,
  busyLabel,
}: {
  action: () => Promise<AiResult>;
  label: string;
  busyLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiResult | null>(null);

  return (
    <div>
      <button
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await action()))}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 text-white text-sm px-4 py-2 hover:bg-violet-500 disabled:opacity-60 transition"
      >
        🤖 {pending ? busyLabel : label}
      </button>
      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-emerald-700" : "text-red-600"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

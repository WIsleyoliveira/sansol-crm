"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

export type KanbanCard = {
  id: string;
  href?: string;
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: string;
  daysInStage: number;
  slaDays?: number | null;
  ownerInitials?: string;
};

export type KanbanColumn = {
  id: string;
  name: string;
  probability?: number;
  isTerminal?: boolean;
  totalText?: string;
  cards: KanbanCard[];
};

export function Kanban({
  columns,
  moveAction,
}: {
  columns: KanbanColumn[];
  moveAction: (cardId: string, toColumnId: string) => Promise<void>;
}) {
  const [cols, setCols] = useState(columns);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onDrop(toColId: string) {
    if (!dragging) return;
    const cardId = dragging;
    setDragging(null);
    setCols((prev) => {
      const fromCol = prev.find((c) => c.cards.some((k) => k.id === cardId));
      if (!fromCol || fromCol.id === toColId) return prev;
      const card = fromCol.cards.find((k) => k.id === cardId)!;
      return prev.map((c) => {
        if (c.id === fromCol.id) return { ...c, cards: c.cards.filter((k) => k.id !== cardId) };
        if (c.id === toColId) return { ...c, cards: [{ ...card, daysInStage: 0 }, ...c.cards] };
        return c;
      });
    });
    startTransition(() => moveAction(cardId, toColId));
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start">
      {cols.map((col) => (
        <div
          key={col.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(col.id)}
          className="w-72 shrink-0 rounded-xl bg-zinc-100/80 border border-zinc-200"
        >
          <div className="px-3 py-2.5 flex items-center justify-between border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-700">{col.name}</span>
              <span className="text-xs rounded-full bg-zinc-200 px-1.5 py-0.5 text-zinc-600">{col.cards.length}</span>
            </div>
            {col.probability !== undefined && !col.isTerminal && (
              <span className="text-[11px] text-zinc-400">{col.probability}%</span>
            )}
          </div>
          {col.totalText && (
            <div className="px-3 py-1.5 text-[11px] text-zinc-500 border-b border-zinc-200/70">
              {col.totalText}
            </div>
          )}
          <div className="p-2 space-y-2 min-h-16">
            {col.cards.map((card) => {
              const overSla = card.slaDays != null && card.daysInStage > card.slaDays;
              const inner = (
                <div
                  draggable
                  onDragStart={() => setDragging(card.id)}
                  className={`rounded-lg bg-white border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow transition ${
                    overSla ? "border-red-300" : "border-zinc-200"
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-900 leading-snug">{card.title}</div>
                  {card.subtitle && <div className="text-xs text-zinc-500 mt-0.5">{card.subtitle}</div>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      {card.amount && <span className="text-xs font-semibold text-emerald-700">{card.amount}</span>}
                      {card.badge && <span className="text-[10px] rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">{card.badge}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] ${overSla ? "text-red-600 font-semibold" : "text-zinc-400"}`}>
                        {card.daysInStage}d {overSla ? "⚠" : ""}
                      </span>
                      {card.ownerInitials && (
                        <span className="h-5 w-5 rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-600 flex items-center justify-center">
                          {card.ownerInitials}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
              return card.href ? (
                <Link key={card.id} href={card.href} draggable={false} className="block">{inner}</Link>
              ) : (
                <div key={card.id}>{inner}</div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function brl(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function kwp(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `${n.toLocaleString("pt-BR")} kWp`;
}

export function kwh(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `${n.toLocaleString("pt-BR")} kWh`;
}

export function daysSince(d: Date | string | null): number {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export function dateBR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export function relTime(d: Date | string): string {
  const days = daysSince(d);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 0) return `em ${-days}d`;
  return `há ${days}d`;
}

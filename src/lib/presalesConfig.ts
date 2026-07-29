// Configuração da pré-venda. Mora na coluna jsonb `workspaces.settings`
// (que já existia vazia) para não precisar de tabela nova.

export type PresalesConfig = {
  /** Valor fixo de comissão do SDR por lead qualificado e entregue (R$). */
  sdrCommissionPerLead: number;
  /** Preço de referência por Wp instalado (R$/Wp) — base do valor estimado. */
  pricePerWp: number;
  /** Performance ratio usado no dimensionamento estimado. */
  performanceRatio: number;
};

export const PRESALES_CONFIG_DEFAULTS: PresalesConfig = {
  sdrCommissionPerLead: 50,
  pricePerWp: 4,
  performanceRatio: 0.8,
};

function num(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Lê a config de pré-venda de `workspaces.settings`, caindo nos padrões. */
export function presalesConfig(settings: unknown): PresalesConfig {
  const raw = (settings as { presales?: Partial<Record<keyof PresalesConfig, unknown>> } | null)?.presales;
  if (!raw) return PRESALES_CONFIG_DEFAULTS;
  return {
    sdrCommissionPerLead: num(raw.sdrCommissionPerLead, PRESALES_CONFIG_DEFAULTS.sdrCommissionPerLead),
    pricePerWp: num(raw.pricePerWp, PRESALES_CONFIG_DEFAULTS.pricePerWp),
    performanceRatio: num(raw.performanceRatio, PRESALES_CONFIG_DEFAULTS.performanceRatio),
  };
}

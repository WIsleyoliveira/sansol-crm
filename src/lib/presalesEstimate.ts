// Estimativa de porte e valor do sistema a partir do consumo do lead.
// Serve para o SDR e o gestor terem noção do tamanho do pipeline de
// pré-venda em reais, antes de existir proposta técnica.
//
//   kWp     = consumo mensal / (irradiação × 30 × performance ratio)
//   valorR$ = kWp × 1000 × preço por Wp
//
// Reaproveita a base de irradiação que já existe no projeto (src/lib/irradiacao.ts).

import { irradiacaoPorLocalizacao } from "@/lib/irradiacao";
import { PRESALES_CONFIG_DEFAULTS, type PresalesConfig } from "@/lib/presalesConfig";

export type EstimateInput = {
  avgMonthlyConsumptionKwh?: number | null;
  state?: string | null;
  city?: string | null;
};

export type Estimate = { kwp: number; value: number } | null;

/** Estimativa do sistema. Retorna null quando falta consumo ou UF. */
export function estimateSystem(lead: EstimateInput, config: PresalesConfig = PRESALES_CONFIG_DEFAULTS): Estimate {
  const consumption = lead.avgMonthlyConsumptionKwh ?? 0;
  if (consumption <= 0 || !lead.state?.trim()) return null;

  const irr = irradiacaoPorLocalizacao(lead.state, lead.city);
  if (!irr) return null;

  // Arredonda o kWp primeiro e deriva o valor dele, para que o número
  // mostrado na tela e o valor em reais sempre se reconciliem.
  const kwp = Math.round((consumption / (irr.irradiacaoKwhM2Dia * 30 * config.performanceRatio)) * 100) / 100;
  return {
    kwp,
    value: Math.round(kwp * 1000 * config.pricePerWp),
  };
}

/** Soma o valor estimado de uma lista de leads (para o topo das colunas). */
export function sumEstimatedValue(leads: EstimateInput[], config: PresalesConfig = PRESALES_CONFIG_DEFAULTS): number {
  return leads.reduce((total, lead) => total + (estimateSystem(lead, config)?.value ?? 0), 0);
}

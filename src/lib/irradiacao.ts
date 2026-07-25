// Irradiação solar média por localização (kWh/m²·dia, média anual do plano
// horizontal). Valores derivados do Atlas Brasileiro de Energia Solar (INPE,
// 2ª ed.). Base local — funciona offline; a rota /api/irradiacao expõe a
// consulta para a calculadora e integrações externas.

export const IRRADIACAO_UF: Record<string, number> = {
  AC: 4.6, AL: 5.5, AP: 4.9, AM: 4.5, BA: 5.6, CE: 5.7, DF: 5.4, ES: 5.0,
  GO: 5.4, MA: 5.3, MT: 5.3, MS: 5.2, MG: 5.4, PA: 4.9, PB: 5.6, PR: 4.8,
  PE: 5.6, PI: 5.7, RJ: 5.0, RN: 5.8, RS: 4.8, RO: 4.7, RR: 4.7, SC: 4.6,
  SP: 5.1, SE: 5.5, TO: 5.4,
};

// Ajustes municipais onde a média difere da UF (cidades da região de atuação
// e capitais). Chave: "UF:cidade" normalizada em minúsculas sem acento.
const IRRADIACAO_CIDADE: Record<string, number> = {
  "SC:florianopolis": 4.5,
  "SC:sao jose": 4.5,
  "SC:palhoca": 4.5,
  "SC:itajai": 4.6,
  "SC:bombinhas": 4.6,
  "SC:blumenau": 4.4,
  "SC:joinville": 4.3,
  "SC:chapeco": 4.9,
  "SC:xanxere": 4.9,
  "SC:lages": 4.8,
  "SC:criciuma": 4.7,
  "RS:porto alegre": 4.8,
  "PR:curitiba": 4.5,
  "SP:sao paulo": 4.9,
  "RJ:rio de janeiro": 5.0,
  "MG:belo horizonte": 5.5,
  "BA:salvador": 5.5,
  "CE:fortaleza": 5.8,
};

function normalize(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export type IrradiacaoResult = {
  uf: string;
  cidade: string | null;
  irradiacaoKwhM2Dia: number;
  fonte: "cidade" | "uf";
};

export function irradiacaoPorLocalizacao(uf: string, cidade?: string | null): IrradiacaoResult | null {
  const ufKey = uf.trim().toUpperCase();
  const ufValue = IRRADIACAO_UF[ufKey];
  if (!ufValue) return null;

  if (cidade) {
    const cityValue = IRRADIACAO_CIDADE[`${ufKey}:${normalize(cidade)}`];
    if (cityValue) {
      return { uf: ufKey, cidade: cidade.trim(), irradiacaoKwhM2Dia: cityValue, fonte: "cidade" };
    }
  }
  return { uf: ufKey, cidade: cidade?.trim() || null, irradiacaoKwhM2Dia: ufValue, fonte: "uf" };
}

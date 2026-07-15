import Anthropic from "@anthropic-ai/sdk";

// Agentes de IA da Sansol. Requerem ANTHROPIC_API_KEY no ambiente (.env.local).
export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = "claude-opus-4-8";

export type SizingSuggestion = {
  system_size_kwp: number;
  panel_qty: number;
  panel_model: string;
  inverter_model: string;
  estimated_generation_kwh_month: number;
  estimated_price_brl: number;
  payback_years: number;
  rationale: string;
};

export async function suggestSizing(input: {
  companyName: string;
  avgMonthlyConsumptionKwh: number;
  roofType: string | null;
  roofAreaM2: string | null;
  city: string | null;
  state: string | null;
  catalog: { type: string; manufacturer: string; model: string; specs: unknown; unitPrice: string | null }[];
}): Promise<SizingSuggestion> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system:
      "Você é o agente de dimensionamento fotovoltaico da Sansol (Santa Catarina, Brasil). " +
      "Dimensione sistemas on-grid usando irradiação média de SC (~4,3 kWh/m²/dia, fator de geração ~118 kWh/mês por kWp). " +
      "Use apenas equipamentos do catálogo fornecido. Preços de mercado brasileiro, sistema completo instalado (~R$ 3,50-4,20/Wp para comercial). " +
      "Responda somente com o JSON pedido.",
    messages: [
      {
        role: "user",
        content:
          `Cliente: ${input.companyName}\n` +
          `Consumo médio mensal: ${input.avgMonthlyConsumptionKwh} kWh\n` +
          `Telhado: ${input.roofType ?? "desconhecido"}, ${input.roofAreaM2 ?? "?"} m²\n` +
          `Local: ${input.city ?? "?"}/${input.state ?? "SC"}\n\n` +
          `Catálogo de equipamentos:\n${JSON.stringify(input.catalog, null, 2)}\n\n` +
          `Dimensione o sistema para compensar ~100% do consumo.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            system_size_kwp: { type: "number" },
            panel_qty: { type: "integer" },
            panel_model: { type: "string" },
            inverter_model: { type: "string" },
            estimated_generation_kwh_month: { type: "integer" },
            estimated_price_brl: { type: "number" },
            payback_years: { type: "number" },
            rationale: { type: "string", description: "2-3 frases explicando o dimensionamento, em português" },
          },
          required: [
            "system_size_kwp", "panel_qty", "panel_model", "inverter_model",
            "estimated_generation_kwh_month", "estimated_price_brl", "payback_years", "rationale",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("O agente de IA recusou a solicitação.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Resposta vazia do agente de IA.");
  return JSON.parse(text.text) as SizingSuggestion;
}

export type NextActionSuggestion = {
  opportunity_id: string;
  task_title: string;
  task_type: "call" | "email" | "meeting" | "visit" | "todo";
  reasoning: string;
};

export async function suggestNextActions(input: {
  opportunities: {
    id: string;
    name: string;
    stage: string;
    amount: string | null;
    daysInStage: number;
    lastActivities: string[];
  }[];
}): Promise<NextActionSuggestion[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system:
      "Você é o agente de next-best-action do CRM da Sansol (energia solar B2B, Brasil). " +
      "Para cada oportunidade parada, sugira UMA próxima ação concreta e específica para o vendedor destravar o negócio. " +
      "Títulos de tarefa curtos, acionáveis, em português. Responda somente com o JSON pedido.",
    messages: [
      {
        role: "user",
        content:
          `Oportunidades paradas no funil:\n${JSON.stringify(input.opportunities, null, 2)}\n\n` +
          `Sugira a próxima ação para cada uma.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  opportunity_id: { type: "string" },
                  task_title: { type: "string" },
                  task_type: { type: "string", enum: ["call", "email", "meeting", "visit", "todo"] },
                  reasoning: { type: "string" },
                },
                required: ["opportunity_id", "task_title", "task_type", "reasoning"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("O agente de IA recusou a solicitação.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Resposta vazia do agente de IA.");
  return (JSON.parse(text.text) as { suggestions: NextActionSuggestion[] }).suggestions;
}

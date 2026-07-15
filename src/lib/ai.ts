import Anthropic from "@anthropic-ai/sdk";

// Agentes de IA da Sansol — camada com dois provedores:
//  - Anthropic (claude-opus-4-8) quando ANTHROPIC_API_KEY está definida
//  - Ollama local (default) em OLLAMA_URL/OLLAMA_MODEL
const ANTHROPIC_MODEL = "claude-opus-4-8";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

export function aiAvailable(): boolean {
  return true; // Ollama é o fallback local; erros de conexão são tratados em runtime
}

export function aiProviderLabel(): string {
  return process.env.ANTHROPIC_API_KEY ? `Claude (${ANTHROPIC_MODEL})` : `Ollama (${OLLAMA_MODEL})`;
}

type JsonSchema = Record<string, unknown>;

async function generateJson<T>(system: string, user: string, schema: JsonSchema): Promise<T> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
    });
    if (response.stop_reason === "refusal") throw new Error("O agente de IA recusou a solicitação.");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("Resposta vazia do agente de IA.");
    return JSON.parse(text.text) as T;
  }

  // Ollama nativo: /api/chat com `format` = JSON schema (structured outputs)
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: schema,
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    throw new Error(`Ollama não respondeu em ${OLLAMA_URL}. Ele está rodando? (ollama serve)`);
  }
  if (!res.ok) {
    throw new Error(`Ollama retornou ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Resposta vazia do Ollama.");
  return JSON.parse(content) as T;
}

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

const sizingSchema: JsonSchema = {
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
  return generateJson<SizingSuggestion>(
    "Você é o agente de dimensionamento fotovoltaico da Sansol (Santa Catarina, Brasil). " +
      "Dimensione sistemas on-grid usando irradiação média de SC (fator de geração ~118 kWh/mês por kWp). " +
      "Use apenas equipamentos do catálogo fornecido. Preços de mercado brasileiro, sistema completo instalado (~R$ 3,50-4,20/Wp para comercial). " +
      "Responda somente com o JSON pedido.",
    `Cliente: ${input.companyName}\n` +
      `Consumo médio mensal: ${input.avgMonthlyConsumptionKwh} kWh\n` +
      `Telhado: ${input.roofType ?? "desconhecido"}, ${input.roofAreaM2 ?? "?"} m²\n` +
      `Local: ${input.city ?? "?"}/${input.state ?? "SC"}\n\n` +
      `Catálogo de equipamentos:\n${JSON.stringify(input.catalog, null, 2)}\n\n` +
      `Dimensione o sistema para compensar ~100% do consumo. ` +
      `Exemplo: consumo de 2360 kWh/mês → ~20 kWp.`,
    sizingSchema,
  );
}

export type NextActionSuggestion = {
  opportunity_id: string;
  task_title: string;
  task_type: "call" | "email" | "meeting" | "visit" | "todo";
  reasoning: string;
};

const nextActionsSchema: JsonSchema = {
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
  const result = await generateJson<{ suggestions: NextActionSuggestion[] }>(
    "Você é o agente de next-best-action do CRM da Sansol (energia solar B2B, Brasil). " +
      "Para cada oportunidade parada, sugira UMA próxima ação concreta e específica para o vendedor destravar o negócio. " +
      "Use o campo `id` de cada oportunidade como `opportunity_id`, copiado exatamente. " +
      "Títulos de tarefa curtos, acionáveis, em português. Responda somente com o JSON pedido.",
    `Oportunidades paradas no funil:\n${JSON.stringify(input.opportunities, null, 2)}\n\n` +
      `Sugira a próxima ação para cada uma.`,
    nextActionsSchema,
  );
  return result.suggestions;
}

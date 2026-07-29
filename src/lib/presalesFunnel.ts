// Funil de pré-venda (SDR): fonte única das etapas, dos SLAs e dos campos
// obrigatórios para avançar. Usado no servidor (validação de verdade, em
// actions-presales.ts) e no cliente (para bloquear o arraste antes de mexer
// na tela). Não importa nada do banco — só tipos simples.

export type PresalesStatus =
  | "sem_contato"
  | "em_contato"
  | "qualificacao"
  | "aguardando_vendedor"
  | "convertido"
  | "incompativel";

// Cada requisito tem um teste e um rótulo explicando o que falta ao usuário.
export type Requirement =
  | "contactAttempt"
  | "contacted"
  | "consumption"
  | "utility"
  | "location"
  | "bill"
  | "lostReason";

export type PresalesStage = {
  id: PresalesStatus;
  label: string;
  shortLabel: string;
  /** Dias tolerados na etapa antes de acusar atraso. null = etapa terminal. */
  slaDays: number | null;
  terminal?: boolean;
  requires: readonly Requirement[];
  /** Etapa que representa perda/descarte — não conta como avanço no funil. */
  isLost?: boolean;
};

export const PRESALES_STAGES: readonly PresalesStage[] = [
  {
    id: "sem_contato",
    label: "Sem contato / Novo lead",
    shortLabel: "Sem contato",
    slaDays: 1,
    requires: [],
  },
  {
    id: "em_contato",
    label: "Em contato / Tentativa",
    shortLabel: "Em contato",
    slaDays: 3,
    requires: ["contactAttempt"],
  },
  {
    id: "qualificacao",
    label: "Qualificação / Coleta de fatura",
    shortLabel: "Qualificação",
    slaDays: 5,
    requires: ["contacted"],
  },
  {
    id: "aguardando_vendedor",
    label: "Aguardando vendedor / Qualificado",
    shortLabel: "Aguardando vendedor",
    slaDays: 2,
    requires: ["consumption", "utility", "location", "bill"],
  },
  {
    id: "convertido",
    label: "Convertido",
    shortLabel: "Convertido",
    slaDays: null,
    terminal: true,
    requires: [],
  },
  {
    id: "incompativel",
    label: "Lead incompatível / Perdido",
    shortLabel: "Incompatível",
    slaDays: null,
    terminal: true,
    isLost: true,
    requires: ["lostReason"],
  },
] as const;

export function stageById(id: string): PresalesStage | undefined {
  return PRESALES_STAGES.find((s) => s.id === id);
}

export function stageLabel(id: string): string {
  return stageById(id)?.label ?? id;
}

/** Posição da etapa no funil — usada para saber o que é "avanço". */
export function stageIndex(id: string): number {
  return PRESALES_STAGES.findIndex((s) => s.id === id);
}

// ─── Validação de transição ──────────────────────────────────────────────────

/** Campos do lead que a validação precisa — subconjunto de presalesLeads. */
export type LeadForValidation = {
  attemptCount?: number | null;
  lastContactAt?: Date | string | null;
  avgMonthlyConsumptionKwh?: number | null;
  utilityCompany?: string | null;
  state?: string | null;
  billFileUrl?: string | null;
  billReceivedAt?: Date | string | null;
  lostReason?: string | null;
};

const REQUIREMENTS: Record<Requirement, { label: string; test: (l: LeadForValidation) => boolean }> = {
  contactAttempt: {
    label: "registrar ao menos uma tentativa de contato",
    test: (l) => (l.attemptCount ?? 0) > 0 || l.lastContactAt != null,
  },
  contacted: {
    label: "registrar o contato com o cliente",
    test: (l) => l.lastContactAt != null,
  },
  consumption: {
    label: "consumo médio em kWh",
    test: (l) => (l.avgMonthlyConsumptionKwh ?? 0) > 0,
  },
  utility: {
    label: "distribuidora de energia",
    test: (l) => !!l.utilityCompany?.trim(),
  },
  location: {
    label: "UF do cliente (necessária para estimar o sistema)",
    test: (l) => !!l.state?.trim(),
  },
  bill: {
    label: "fatura de energia (link ou confirmação de recebimento)",
    test: (l) => !!l.billFileUrl?.trim() || l.billReceivedAt != null,
  },
  lostReason: {
    label: "motivo da incompatibilidade",
    test: (l) => !!l.lostReason?.trim(),
  },
};

export type TransitionResult = { ok: boolean; missing: string[] };

/**
 * Diz se o lead pode entrar na etapa destino. Voltar no funil ou ficar na
 * mesma etapa nunca é bloqueado — a exigência vale para avançar e para
 * marcar como incompatível (que pede motivo).
 */
export function validateTransition(lead: LeadForValidation, fromStatus: string, toStatus: string): TransitionResult {
  const to = stageById(toStatus);
  if (!to) return { ok: false, missing: ["etapa de destino inválida"] };

  const isAdvancing = stageIndex(toStatus) > stageIndex(fromStatus);
  // Voltar etapa é livre; só "incompatível" exige motivo mesmo vindo de trás.
  if (!isAdvancing && !to.isLost) return { ok: true, missing: [] };

  const missing = to.requires
    .filter((r) => !REQUIREMENTS[r].test(lead))
    .map((r) => REQUIREMENTS[r].label);

  return { ok: missing.length === 0, missing };
}

// ─── SLA ─────────────────────────────────────────────────────────────────────

export type SlaState = "ok" | "atrasado" | "sem_sla";

export function slaState(status: string, stageEnteredAt: Date | string | null): SlaState {
  const stage = stageById(status);
  if (!stage || stage.slaDays == null || !stageEnteredAt) return "sem_sla";
  const days = Math.floor((Date.now() - new Date(stageEnteredAt).getTime()) / 86400000);
  return days > stage.slaDays ? "atrasado" : "ok";
}

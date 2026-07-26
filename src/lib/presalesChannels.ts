export const PRESALES_CHANNELS = [
  { value: "meta_ads", label: "Tráfego pago (Meta)" },
  { value: "google_ads", label: "Tráfego pago (Google)" },
  { value: "social_organic", label: "Mídia social (orgânico)" },
  { value: "prospeccao", label: "Prospecção" },
  { value: "indicacao", label: "Indicação" },
  { value: "whatsapp", label: "WhatsApp direto" },
  { value: "outro", label: "Outro" },
] as const;

export type PresalesChannel = (typeof PRESALES_CHANNELS)[number]["value"];

export function channelLabel(channel: string): string {
  return PRESALES_CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}

export const PRESALES_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "em_conversa", label: "Em conversa" },
  { value: "qualificado", label: "Qualificado" },
  { value: "descartado", label: "Descartado" },
] as const;

export const CLASSIFICATION_LABELS: Record<string, string> = {
  quente: "Quente", morno: "Morno", frio: "Frio",
};

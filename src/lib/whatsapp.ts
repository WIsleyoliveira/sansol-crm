// Camada de provedor WhatsApp. Usa Evolution API (self-hosted, open-source)
// quando EVOLUTION_API_URL está configurado; caso contrário roda em modo
// simulado (mensagens são gravadas como enviadas, sem tráfego real) —
// mesmo padrão de fallback usado em src/lib/ai.ts para os agentes de IA.
const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? "sansol";

export function whatsappMode(): "evolution" | "simulated" {
  return EVOLUTION_URL ? "evolution" : "simulated";
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export type SendResult = { ok: boolean; providerMessageId?: string; error?: string };

export async function sendWhatsappMessage(phone: string, text: string): Promise<SendResult> {
  if (whatsappMode() === "simulated") {
    // Sem servidor Evolution configurado: grava como enviado localmente.
    return { ok: true, providerMessageId: `sim_${Date.now()}` };
  }

  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY ?? "" },
      body: JSON.stringify({ number: normalizePhone(phone), text }),
    });
    if (!res.ok) {
      return { ok: false, error: `Evolution API retornou ${res.status}` };
    }
    const data = (await res.json()) as { key?: { id?: string } };
    return { ok: true, providerMessageId: data.key?.id };
  } catch {
    return { ok: false, error: `Não foi possível conectar em ${EVOLUTION_URL}. O servidor Evolution está no ar?` };
  }
}

export function connectionInstructions(): string {
  return (
    "Para conectar o WhatsApp de verdade:\n" +
    "1. Suba o Evolution API (docker run, ver docs.evolution-api.com)\n" +
    "2. Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE em .env.local\n" +
    "3. Escaneie o QR code gerado pelo Evolution para parear seu número\n" +
    "4. Aponte o webhook do Evolution para /api/webhooks/evolution deste CRM"
  );
}

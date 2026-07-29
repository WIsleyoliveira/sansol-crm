import { NextResponse } from "next/server";
import { irradiacaoPorLocalizacao, IRRADIACAO_UF } from "@/lib/irradiacao";

// GET /api/irradiacao?uf=SC&cidade=Florianopolis
// Retorna a irradiação média (kWh/m²·dia) para a localização informada.
// Sem parâmetros, lista as médias por UF.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uf = searchParams.get("uf");
  const cidade = searchParams.get("cidade");

  if (!uf) {
    return NextResponse.json({ ufs: IRRADIACAO_UF });
  }

  const result = irradiacaoPorLocalizacao(uf, cidade);
  if (!result) {
    return NextResponse.json({ error: `UF desconhecida: ${uf}` }, { status: 400 });
  }
  return NextResponse.json(result);
}

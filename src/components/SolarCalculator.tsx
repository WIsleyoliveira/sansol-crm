"use client";

import { useEffect, useState } from "react";
import { Ruler, Zap, Sun, LayoutGrid, MapPin } from "lucide-react";

const PANEL_WATTS = 665;
const PANEL_AREA_M2 = 2.1;
const PR = 0.8;

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function SolarCalculator() {
  const [consumo, setConsumo] = useState(3600);
  const [irradiacao, setIrradiacao] = useState(4.8);
  const [offset, setOffset] = useState(100);
  const [uf, setUf] = useState("SC");
  const [cidade, setCidade] = useState("");
  const [fonte, setFonte] = useState<string | null>(null);

  // Busca a irradiação pela localização na API interna (/api/irradiacao)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ uf });
        if (cidade.trim()) params.set("cidade", cidade.trim());
        const res = await fetch(`/api/irradiacao?${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as { irradiacaoKwhM2Dia: number; fonte: "cidade" | "uf" };
        setIrradiacao(data.irradiacaoKwhM2Dia);
        setFonte(data.fonte === "cidade" ? `média de ${cidade.trim()}/${uf}` : `média de ${uf}`);
      } catch {
        // offline/erro: mantém o valor digitado manualmente
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [uf, cidade]);

  const alvoKwh = consumo * (offset / 100);
  const kwp = (alvoKwh / (irradiacao * 30 * PR));
  const paineis = Math.ceil((kwp * 1000) / PANEL_WATTS);
  const kwpReal = (paineis * PANEL_WATTS) / 1000;
  const geracao = Math.round(kwpReal * irradiacao * 30 * PR);
  const area = Math.round(paineis * PANEL_AREA_M2);
  const inversorKw = Math.ceil(kwpReal * 0.85);

  const inputCls = "w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm tabular-nums focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none";
  const card = "rounded-2xl bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.12)]";

  const results = [
    { label: "Potência do sistema", value: `${kwpReal.toFixed(2).replace(".", ",")} kWp`, Icon: Zap, tint: "bg-amber-50 text-amber-600" },
    { label: "Nº de painéis", value: `${paineis} × ${PANEL_WATTS}W`, Icon: LayoutGrid, tint: "bg-sky-50 text-sky-600" },
    { label: "Geração estimada", value: `${geracao.toLocaleString("pt-BR")} kWh/mês`, Icon: Sun, tint: "bg-emerald-50 text-emerald-600" },
    { label: "Inversor sugerido", value: `${inversorKw} kW`, Icon: Zap, tint: "bg-violet-50 text-violet-600" },
    { label: "Área necessária", value: `${area} m²`, Icon: Ruler, tint: "bg-zinc-100 text-zinc-600" },
  ];

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Ruler className="h-4 w-4" /></div>
        <div className="font-semibold text-zinc-800">Calculadora de dimensionamento</div>
      </div>

      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">UF</span>
          <select value={uf} onChange={(e) => setUf(e.target.value)} className={`${inputCls} mt-1 bg-white`}>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Cidade</span>
          <input value={cidade} placeholder="Florianópolis" onChange={(e) => setCidade(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Consumo médio (kWh/mês)</span>
          <input type="number" value={consumo} min={0} onChange={(e) => setConsumo(Number(e.target.value))} className={`${inputCls} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Irradiação (kWh/m²·dia)</span>
          <input type="number" step="0.1" value={irradiacao} min={1} onChange={(e) => { setIrradiacao(Number(e.target.value)); setFonte(null); }} className={`${inputCls} mt-1`} />
          {fonte && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <MapPin className="h-3 w-3" /> {fonte}
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Compensação alvo (%)</span>
          <input type="number" value={offset} min={1} max={200} onChange={(e) => setOffset(Number(e.target.value))} className={`${inputCls} mt-1`} />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {results.map((r) => (
          <div key={r.label} className="rounded-xl border border-zinc-100 p-3.5">
            <div className={`h-7 w-7 rounded-lg ${r.tint} flex items-center justify-center mb-2`}><r.Icon className="h-3.5 w-3.5" /></div>
            <div className="text-[15px] font-bold text-zinc-900 tracking-tight tabular-nums">{r.value}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">{r.label}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-400 mt-4">
        Cálculo com Performance Ratio {PR} e painéis de {PANEL_WATTS}W. Ajuste conforme sombreamento, orientação e inclinação do telhado.
      </p>
    </div>
  );
}

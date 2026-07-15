import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as s from "./schema";

const client = new PGlite("./pgdata");
const db = drizzle(client, { schema: s });

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}
function daysAhead(n: number) {
  return new Date(Date.now() + n * 86400000);
}

async function main() {
  console.log("Seeding Sansol CRM…");

  const [ws] = await db.insert(s.workspaces).values({
    name: "Sansol Energia Solar",
    slug: "sansol",
    plan: "pro",
    settings: { currency: "BRL", timezone: "America/Sao_Paulo" },
  }).returning();

  const usersData = [
    { email: "ana@sansol.com.br", name: "Ana Ribeiro", role: "owner" as const },
    { email: "bruno@sansol.com.br", name: "Bruno Costa", role: "manager" as const },
    { email: "carla@sansol.com.br", name: "Carla Mendes", role: "rep" as const },
    { email: "diego@sansol.com.br", name: "Diego Alves", role: "rep" as const },
    { email: "edu@sansol.com.br", name: "Eduardo Lima", role: "installer" as const },
  ];
  const users = await db.insert(s.users).values(usersData.map(({ email, name }) => ({ email, name }))).returning();
  await db.insert(s.workspaceMembers).values(
    users.map((u, i) => ({ workspaceId: ws.id, userId: u.id, role: usersData[i].role }))
  );
  const [ana, bruno, carla, diego, edu] = users;

  // Pipelines
  const [salesPipe] = await db.insert(s.pipelines).values({
    workspaceId: ws.id, name: "Vendas", kind: "sales", isDefault: true,
  }).returning();
  const [instPipe] = await db.insert(s.pipelines).values({
    workspaceId: ws.id, name: "Projeto / Instalação", kind: "installation",
  }).returning();

  const salesStages = await db.insert(s.pipelineStages).values([
    { pipelineId: salesPipe.id, name: "Lead qualificado", order: 1, probability: 10, slaDays: 5 },
    { pipelineId: salesPipe.id, name: "Visita técnica", order: 2, probability: 25, slaDays: 7 },
    { pipelineId: salesPipe.id, name: "Proposta enviada", order: 3, probability: 50, slaDays: 7 },
    { pipelineId: salesPipe.id, name: "Negociação", order: 4, probability: 75, slaDays: 10 },
    { pipelineId: salesPipe.id, name: "Contrato assinado", order: 5, probability: 100, isWon: true },
    { pipelineId: salesPipe.id, name: "Perdido", order: 6, probability: 0, isLost: true },
  ]).returning();
  const [stLead, stVisita, stProposta, stNegoc, stGanho, stPerdido] = salesStages;

  const instStages = await db.insert(s.pipelineStages).values([
    { pipelineId: instPipe.id, name: "Projeto / Homologação", order: 1, slaDays: 15 },
    { pipelineId: instPipe.id, name: "Aguardando concessionária", order: 2, slaDays: 34 },
    { pipelineId: instPipe.id, name: "Instalação agendada", order: 3, slaDays: 10 },
    { pipelineId: instPipe.id, name: "Instalação concluída", order: 4, slaDays: 7 },
    { pipelineId: instPipe.id, name: "Sistema ligado", order: 5, isWon: true },
  ]).returning();
  const [iHomolog, iConcess, iAgendada, iConcluida, iLigado] = instStages;

  // Equipment catalog
  await db.insert(s.equipmentCatalog).values([
    { workspaceId: ws.id, type: "panel", manufacturer: "Canadian Solar", model: "HiKu7 665W", specs: { watts: 665, efficiency: 21.4, warranty_years: 25 }, unitCost: "620.00", unitPrice: "890.00" },
    { workspaceId: ws.id, type: "panel", manufacturer: "JA Solar", model: "DeepBlue 4.0 585W", specs: { watts: 585, efficiency: 21.1, warranty_years: 25 }, unitCost: "540.00", unitPrice: "790.00" },
    { workspaceId: ws.id, type: "inverter", manufacturer: "Growatt", model: "MIN 6000TL-X", specs: { kw: 6, phases: 1, warranty_years: 10 }, unitCost: "3200.00", unitPrice: "4500.00" },
    { workspaceId: ws.id, type: "inverter", manufacturer: "Fronius", model: "Primo 8.2-1", specs: { kw: 8.2, phases: 1, warranty_years: 7 }, unitCost: "8900.00", unitPrice: "12400.00" },
    { workspaceId: ws.id, type: "structure", manufacturer: "Romagnole", model: "Kit telhado cerâmico", specs: {}, unitCost: "45.00", unitPrice: "78.00" },
  ]);

  // Companies + contacts + sites
  const companiesData = [
    { name: "Supermercado Bom Preço", industry: "Varejo", size: "51-200", owner: carla },
    { name: "Frigorífico Santa Fé", industry: "Alimentos", size: "201-500", owner: carla },
    { name: "Hotel Vista Verde", industry: "Hotelaria", size: "11-50", owner: diego },
    { name: "Transportadora Rota Sul", industry: "Logística", size: "51-200", owner: diego },
    { name: "Padaria Pão Dourado", industry: "Alimentos", size: "1-10", owner: carla },
    { name: "Clínica Vida Plena", industry: "Saúde", size: "11-50", owner: diego },
    { name: "Auto Peças Silva", industry: "Varejo", size: "11-50", owner: carla },
    { name: "Fazenda Boa Esperança", industry: "Agronegócio", size: "11-50", owner: diego },
  ];
  const companies = await db.insert(s.companies).values(
    companiesData.map((c) => ({ workspaceId: ws.id, name: c.name, industry: c.industry, size: c.size, ownerId: c.owner.id }))
  ).returning();

  const contactsData = [
    { name: "Roberto Nunes", title: "Proprietário", email: "roberto@bompreco.com", phone: "(48) 99911-2233", company: 0 },
    { name: "Fernanda Souza", title: "Gerente Financeiro", email: "fernanda@santafe.ind.br", phone: "(48) 98822-3344", company: 1 },
    { name: "Marcos Teixeira", title: "Diretor", email: "marcos@vistaverde.tur.br", phone: "(47) 99733-4455", company: 2 },
    { name: "Juliana Prado", title: "Sócia", email: "juliana@rotasul.log.br", phone: "(47) 98644-5566", company: 3 },
    { name: "Seu Antônio", title: "Dono", email: "antonio@paodourado.com", phone: "(48) 99555-6677", company: 4 },
    { name: "Dra. Patrícia Ramos", title: "Diretora Clínica", email: "patricia@vidaplena.med.br", phone: "(48) 98466-7788", company: 5 },
    { name: "Carlos Silva", title: "Proprietário", email: "carlos@autopecassilva.com", phone: "(49) 99377-8899", company: 6 },
    { name: "João Boa Esperança", title: "Produtor", email: "joao@boaesperanca.agr.br", phone: "(49) 98288-9900", company: 7 },
  ];
  const contacts = await db.insert(s.contacts).values(
    contactsData.map((c) => ({
      workspaceId: ws.id, name: c.name, title: c.title, email: c.email, phone: c.phone,
      companyId: companies[c.company].id, ownerId: companies[c.company].ownerId,
    }))
  ).returning();

  const sitesData = [
    { company: 0, address: "Av. Central, 1200 — Centro", city: "São José", state: "SC", roofType: "Metálico", roofAreaM2: "850.0", utility: "CELESC", consumption: 8200 },
    { company: 1, address: "Rod. BR-101, km 210", city: "Palhoça", state: "SC", roofType: "Metálico", roofAreaM2: "2400.0", utility: "CELESC", consumption: 32000 },
    { company: 2, address: "Rua das Gaivotas, 88 — Praia", city: "Bombinhas", state: "SC", roofType: "Cerâmico", roofAreaM2: "620.0", utility: "CELESC", consumption: 5400 },
    { company: 3, address: "Av. Industrial, 455", city: "Itajaí", state: "SC", roofType: "Fibrocimento", roofAreaM2: "1100.0", utility: "CELESC", consumption: 4100 },
    { company: 4, address: "Rua XV de Novembro, 233", city: "Florianópolis", state: "SC", roofType: "Cerâmico", roofAreaM2: "180.0", utility: "CELESC", consumption: 1900 },
    { company: 5, address: "Av. Beira Mar, 900 — sala térrea", city: "Florianópolis", state: "SC", roofType: "Laje", roofAreaM2: "310.0", utility: "CELESC", consumption: 3600 },
    { company: 6, address: "Rua do Comércio, 45", city: "Chapecó", state: "SC", roofType: "Metálico", roofAreaM2: "420.0", utility: "CELESC", consumption: 2300 },
    { company: 7, address: "Estrada Geral, s/n — Interior", city: "Xanxerê", state: "SC", roofType: "Solo (usina)", roofAreaM2: "5000.0", utility: "CELESC", consumption: 12500 },
  ];
  const sites = await db.insert(s.sites).values(
    sitesData.map((x) => ({
      workspaceId: ws.id, companyId: companies[x.company].id, address: x.address, city: x.city, state: x.state,
      roofType: x.roofType, roofAreaM2: x.roofAreaM2, utilityCompany: x.utility, tariffClass: "B3",
      avgMonthlyConsumptionKwh: x.consumption,
    }))
  ).returning();

  // Opportunities across sales stages
  const oppsData = [
    { name: "Supermercado Bom Preço — 75 kWp", company: 0, stage: stVisita, amount: "295000.00", kwp: "75.00", owner: carla, source: "Indicação", days: 3, close: 40 },
    { name: "Frigorífico Santa Fé — 290 kWp", company: 1, stage: stNegoc, amount: "1090000.00", kwp: "290.00", owner: carla, source: "Tráfego pago", days: 12, close: 20 },
    { name: "Hotel Vista Verde — 48 kWp", company: 2, stage: stProposta, amount: "192000.00", kwp: "48.00", owner: diego, source: "Site", days: 9, close: 30 },
    { name: "Transportadora Rota Sul — 36 kWp", company: 3, stage: stLead, amount: "148000.00", kwp: "36.00", owner: diego, source: "Indicação", days: 1, close: 60 },
    { name: "Padaria Pão Dourado — 16 kWp", company: 4, stage: stProposta, amount: "68000.00", kwp: "16.00", owner: carla, source: "Indicação", days: 11, close: 25 },
    { name: "Clínica Vida Plena — 32 kWp", company: 5, stage: stGanho, amount: "134000.00", kwp: "32.00", owner: diego, source: "Site", days: 2, close: -5, won: true },
    { name: "Auto Peças Silva — 20 kWp", company: 6, stage: stGanho, amount: "84000.00", kwp: "20.00", owner: carla, source: "Tráfego pago", days: 30, close: -30, won: true },
    { name: "Fazenda Boa Esperança — usina 110 kWp", company: 7, stage: stNegoc, amount: "410000.00", kwp: "110.00", owner: diego, source: "Feira agro", days: 6, close: 15 },
    { name: "Hotel Vista Verde — ampliação 12 kWp", company: 2, stage: stPerdido, amount: "52000.00", kwp: "12.00", owner: diego, source: "Base", days: 20, close: -10, lost: true },
  ];
  const opps = await db.insert(s.opportunities).values(
    oppsData.map((o) => ({
      workspaceId: ws.id, pipelineId: salesPipe.id, stageId: o.stage.id,
      companyId: companies[o.company].id, primaryContactId: contacts[o.company].id,
      ownerId: o.owner.id, name: o.name, amount: o.amount, systemSizeKwp: o.kwp,
      leadSource: o.source,
      status: o.won ? ("won" as const) : o.lost ? ("lost" as const) : ("open" as const),
      lostReason: o.lost ? "Optou por concorrente com financiamento próprio" : null,
      expectedCloseDate: daysAhead(o.close),
      closedAt: o.won || o.lost ? daysAgo(Math.abs(o.close)) : null,
      stageEnteredAt: daysAgo(o.days),
      createdAt: daysAgo(o.days + 15),
    }))
  ).returning();

  // Stage history + activities for each opp
  for (let i = 0; i < opps.length; i++) {
    const o = opps[i];
    await db.insert(s.opportunityStageHistory).values({
      opportunityId: o.id, fromStageId: null, toStageId: stLead.id,
      changedBy: o.ownerId, changedAt: daysAgo(oppsData[i].days + 15),
    });
    if (o.stageId !== stLead.id) {
      await db.insert(s.opportunityStageHistory).values({
        opportunityId: o.id, fromStageId: stLead.id, toStageId: o.stageId,
        changedBy: o.ownerId, changedAt: daysAgo(oppsData[i].days),
        timeInStageSeconds: 15 * 86400,
      });
    }
    await db.insert(s.activities).values([
      { workspaceId: ws.id, actorId: o.ownerId, actorType: "user", relatedToType: "opportunity", relatedToId: o.id, type: "note", payload: { text: "Primeiro contato realizado, cliente demonstrou interesse em reduzir a conta de energia." }, createdAt: daysAgo(oppsData[i].days + 14) },
      { workspaceId: ws.id, actorId: o.ownerId, actorType: "user", relatedToType: "opportunity", relatedToId: o.id, type: "call_logged", payload: { text: "Ligação de qualificação — consumo médio confirmado, decisor identificado." }, createdAt: daysAgo(oppsData[i].days + 10) },
      { workspaceId: ws.id, actorId: null, actorType: "ai_agent", relatedToType: "opportunity", relatedToId: o.id, type: "ai_suggestion", payload: { text: `Sugestão: dimensionamento estimado de ${oppsData[i].kwp} kWp com base no consumo informado. Payback projetado ~3,8 anos.` }, createdAt: daysAgo(oppsData[i].days + 9) },
    ]);
  }

  // Proposals for opps in proposta+ stages
  const propOpps = [1, 2, 4, 5, 6, 7];
  for (const i of propOpps) {
    const o = opps[i];
    await db.insert(s.proposals).values({
      workspaceId: ws.id, opportunityId: o.id, version: 1,
      systemSizeKwp: oppsData[i].kwp,
      panelModel: "Canadian Solar HiKu7 665W",
      panelQty: Math.round(parseFloat(oppsData[i].kwp) * 1000 / 665),
      inverterModel: "Growatt MIN 6000TL-X",
      estimatedGenerationKwhMonth: Math.round(parseFloat(oppsData[i].kwp) * 118),
      paybackYears: "3.8",
      totalPrice: oppsData[i].amount,
      financingType: i % 2 === 0 ? "financing" : "cash",
      installments: i % 2 === 0 ? 60 : null,
      status: oppsData[i].won ? "accepted" : "sent",
    });
  }

  // Surveys
  await db.insert(s.siteSurveys).values([
    { workspaceId: ws.id, siteId: sites[0].id, opportunityId: opps[0].id, surveyorId: edu.id, scheduledAt: daysAhead(2), technicalFeasibility: "pending" },
    { workspaceId: ws.id, siteId: sites[1].id, opportunityId: opps[1].id, surveyorId: edu.id, scheduledAt: daysAgo(8), completedAt: daysAgo(8), technicalFeasibility: "viable", structuralNotes: "Estrutura metálica em ótimo estado, sem sombreamento." },
    { workspaceId: ws.id, siteId: sites[5].id, opportunityId: opps[5].id, surveyorId: edu.id, scheduledAt: daysAgo(20), completedAt: daysAgo(20), technicalFeasibility: "viable", structuralNotes: "Laje impermeabilizada, instalar com estrutura inclinada 15°." },
    { workspaceId: ws.id, siteId: sites[7].id, opportunityId: opps[7].id, surveyorId: edu.id, scheduledAt: daysAhead(4), technicalFeasibility: "pending" },
  ]);

  // Installation projects for won opps
  await db.insert(s.installationProjects).values([
    {
      workspaceId: ws.id, opportunityId: opps[5].id, siteId: sites[5].id,
      projectManagerId: bruno.id, installerId: edu.id, stageId: iHomolog.id,
      permitStatus: "submitted", utilityApprovalStatus: "pending",
      stageEnteredAt: daysAgo(4),
    },
    {
      workspaceId: ws.id, opportunityId: opps[6].id, siteId: sites[6].id,
      projectManagerId: bruno.id, installerId: edu.id, stageId: iAgendada.id,
      permitStatus: "approved", utilityApprovalStatus: "approved",
      installationScheduledAt: daysAhead(5), stageEnteredAt: daysAgo(2),
    },
  ]);

  // Tasks
  await db.insert(s.tasks).values([
    { workspaceId: ws.id, relatedToType: "opportunity", relatedToId: opps[0].id, assigneeId: edu.id, createdBy: carla.id, type: "visit", title: "Visita técnica — Supermercado Bom Preço", dueAt: daysAhead(2) },
    { workspaceId: ws.id, relatedToType: "opportunity", relatedToId: opps[1].id, assigneeId: carla.id, createdBy: bruno.id, type: "meeting", title: "Reunião de negociação com Fernanda (Frigorífico)", dueAt: daysAhead(1) },
    { workspaceId: ws.id, relatedToType: "opportunity", relatedToId: opps[2].id, assigneeId: diego.id, createdBy: diego.id, type: "call", title: "Follow-up da proposta — Hotel Vista Verde", dueAt: daysAgo(1) },
    { workspaceId: ws.id, relatedToType: "opportunity", relatedToId: opps[4].id, assigneeId: carla.id, createdByAgent: true, type: "call", title: "[IA] Proposta parada há 11 dias — retomar contato com Seu Antônio", dueAt: daysAhead(0) },
    { workspaceId: ws.id, relatedToType: "opportunity", relatedToId: opps[3].id, assigneeId: diego.id, createdBy: diego.id, type: "call", title: "Ligação de qualificação — Rota Sul", dueAt: daysAhead(1) },
    { workspaceId: ws.id, relatedToType: "installation_project", relatedToId: opps[6].id, assigneeId: edu.id, createdBy: bruno.id, type: "visit", title: "Instalação — Auto Peças Silva (20 kWp)", dueAt: daysAhead(5) },
  ]);

  console.log("Seed concluído ✔");
  console.log(`Workspace: ${ws.name} | usuários: ${users.length} | oportunidades: ${opps.length}`);
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });

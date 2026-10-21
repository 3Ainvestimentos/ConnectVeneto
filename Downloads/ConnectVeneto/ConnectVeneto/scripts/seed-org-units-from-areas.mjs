/**
 * Ponto de partida da estrutura (ADR 0004): uma unidade do tipo Área para cada valor do campo
 * `area` do cadastro (juntando variações de espaço/maiúscula), e cada colaborador encaixado na sua.
 *
 * As Áreas nascem sem responsável e no topo (sem Diretoria): enquanto o RH não definir o responsável,
 * o gestor de cada pessoa continua o do cadastro — nada muda no organograma "por pessoa".
 * Depois o RH cria Diretorias e Equipes, move as Áreas e define os responsáveis em Pessoas › Estrutura.
 *
 * Não sobrescreve: só cria a Área se não existir uma com o mesmo nome e só encaixa quem ainda não tem
 * unidade. Pode rodar de novo.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-org-units-from-areas.mjs            # simulação
 *   node --env-file=.env.local scripts/seed-org-units-from-areas.mjs --apply    # grava
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const EMPTY = new Set(['', '-', '--', '—']);

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

const key = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const pretty = (s) => {
  const t = String(s).trim().replace(/\s+/g, ' ');
  return t === t.toLowerCase() && t.length <= 3 ? t.toUpperCase() : t; // "ti" → "TI"
};

const [collabSnap, unitSnap] = await Promise.all([db.collection('collaborators').get(), db.collection('orgUnits').get()]);
const existingByName = new Map(unitSnap.docs.map((d) => [key(d.get('name')), d.id]));

/** Áreas do cadastro → nome canônico (a grafia mais usada). */
const groups = new Map();
for (const d of collabSnap.docs) {
  const raw = String(d.get('area') ?? '').trim();
  if (EMPTY.has(raw)) continue;
  const k = key(raw);
  const g = groups.get(k) ?? { names: new Map(), people: [] };
  g.names.set(raw, (g.names.get(raw) ?? 0) + 1);
  g.people.push(d);
  groups.set(k, g);
}

const now = new Date().toISOString();
const plan = [];
for (const [k, g] of [...groups.entries()].sort()) {
  const name = pretty([...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  const unitId = existingByName.get(k) ?? null;
  const toAssign = g.people.filter((d) => !String(d.get('unitId') ?? '').trim());
  plan.push({ k, name, unitId, toAssign, variants: [...g.names.keys()] });
}
const noArea = collabSnap.docs.filter((d) => EMPTY.has(String(d.get('area') ?? '').trim()) && !d.get('unitId'));

console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — ${plan.length} Áreas a partir do cadastro (${collabSnap.size} colaboradores)`);
for (const p of plan) {
  const variants = p.variants.length > 1 ? `  [junta: ${p.variants.map((v) => `"${v}"`).join(', ')}]` : '';
  console.log(`  ${p.unitId ? '= existe ' : '+ cria   '} Área "${p.name}" · encaixa ${p.toAssign.length}${variants}`);
}
console.log(`  ${noArea.length} sem área no cadastro ficam em "Sem unidade": ${noArea.map((d) => d.get('name')).join(', ') || '—'}`);

if (!APPLY) {
  console.log('\nNada gravado. Rode com --apply para gravar.');
  process.exit(0);
}

let created = 0;
let assigned = 0;
for (const p of plan) {
  let unitId = p.unitId;
  if (!unitId) {
    const ref = await db.collection('orgUnits').add({ name: p.name, type: 'area', parentId: null, leaderIdVeneto: null, createdAt: now, updatedAt: now, updatedBy: 'script:seed-org-units-from-areas' });
    unitId = ref.id;
    created += 1;
  }
  for (let i = 0; i < p.toAssign.length; i += 200) {
    const batch = db.batch();
    for (const d of p.toAssign.slice(i, i + 200)) {
      batch.update(d.ref, { unitId });
      batch.create(db.collection('collaborator_logs').doc(), {
        collaboratorId: d.id,
        collaboratorName: d.get('name') ?? '',
        updatedBy: 'script:seed-org-units-from-areas',
        updatedAt: now,
        source: 'adr-0004-seed',
        changes: [{ field: 'unitId', oldValue: null, newValue: unitId }],
      });
      assigned += 1;
    }
    await batch.commit();
  }
}
console.log(`\nOK: ${created} Áreas criadas, ${assigned} pessoas encaixadas.`);

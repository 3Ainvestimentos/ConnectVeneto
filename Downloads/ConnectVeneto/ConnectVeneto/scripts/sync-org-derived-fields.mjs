/**
 * Deriva `area`, `team` e `leader` do cadastro a partir da estrutura (ADR 0004) para todo mundo que
 * tem unidade — mesma regra de `src/lib/hub/org-derived.ts` (o servidor aplica sozinho a cada mudança
 * de estrutura ou de unidade; este script é a carga inicial):
 *   - area   = Área mais próxima na cadeia da unidade; sem Área, a Diretoria mais próxima; senão não mexe.
 *   - team   = Equipe da cadeia, ou '' se a pessoa não está numa Equipe.
 *   - leader = nome do gestor resolvido (exceção > estrutura > leaderIdVeneto > nome único); sem gestor, não mexe.
 *
 * Também lista as referências de área/equipe gravadas na Consulta Pessoal (Público dos links e
 * admins por área dos tipos) que deixariam de casar com alguém depois da derivação.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-org-derived-fields.mjs            # simulação
 *   node --env-file=.env.local scripts/sync-org-derived-fields.mjs --apply    # grava
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const PEOPLE_PER_BATCH = 200;

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

/** Igual a `normalizeName` (people.ts) e `normalizeLabel` (consulta-links). */
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const isBlankLabel = (v) => !norm(v).replace(/[-—–]/g, '');

const [collabSnap, unitSnap, linksSnap, typesSnap] = await Promise.all([
  db.collection('collaborators').get(),
  db.collection('orgUnits').get(),
  db.collection('consultaLinks').get(),
  db.collection('consultaLinkTypes').get(),
]);
const collaborators = collabSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
const units = new Map(
  unitSnap.docs.map((d) => {
    const v = d.data();
    const type = ['diretoria', 'area', 'equipe'].includes(v.type) ? v.type : 'equipe';
    return [d.id, { id: d.id, name: String(v.name ?? ''), type, parentId: v.parentId || null, leaderIdVeneto: v.leaderIdVeneto || null }];
  }),
);

function unitChain(unitId) {
  const chain = [];
  const seen = new Set();
  let current = unitId ? units.get(unitId) : undefined;
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.parentId ? units.get(current.parentId) : undefined;
  }
  return chain;
}

// Gestor como `buildPeople` resolve (quem está oculto no Hub não entra nem como gestor).
const visible = collaborators.filter((c) => !c.hubHidden);
const byIdVeneto = new Map();
const byName = new Map();
for (const c of visible) {
  if (c.idVeneto) byIdVeneto.set(String(c.idVeneto).trim(), c);
  const key = norm(c.name);
  byName.set(key, [...(byName.get(key) ?? []), c]);
}
function resolveManager(c) {
  if (c.hubHidden) return undefined;
  const unitId = c.unitId && units.has(c.unitId) ? c.unitId : undefined;
  const self = String(c.idVeneto ?? '').trim();
  const fromStructure = unitId ? unitChain(unitId).find((u) => u.leaderIdVeneto && u.leaderIdVeneto !== self)?.leaderIdVeneto : null;
  let manager;
  if (c.managerOverrideIdVeneto && byIdVeneto.has(String(c.managerOverrideIdVeneto).trim())) manager = byIdVeneto.get(String(c.managerOverrideIdVeneto).trim());
  else if (fromStructure && byIdVeneto.has(fromStructure)) manager = byIdVeneto.get(fromStructure);
  else if (c.leaderIdVeneto && byIdVeneto.has(String(c.leaderIdVeneto).trim())) manager = byIdVeneto.get(String(c.leaderIdVeneto).trim());
  else {
    const same = byName.get(norm(c.leader));
    if (same?.length === 1) manager = same[0];
  }
  return manager && manager.id !== c.id ? manager : undefined;
}

const updates = [];
const derivedById = new Map();
for (const c of collaborators) {
  if (!c.unitId || !units.has(c.unitId)) continue;
  const chain = unitChain(c.unitId);
  const values = {};
  const area = chain.find((u) => u.type === 'area') ?? chain.find((u) => u.type === 'diretoria');
  if (area) values.area = area.name;
  values.team = chain.find((u) => u.type === 'equipe')?.name ?? '';
  const manager = resolveManager(c);
  if (manager?.name) values.leader = manager.name;
  derivedById.set(c.id, values);
  const changes = ['area', 'team', 'leader'].flatMap((field) =>
    values[field] === undefined || (c[field] ?? '') === values[field] ? [] : [{ field, oldValue: c[field] ?? null, newValue: values[field] }],
  );
  if (changes.length) updates.push({ id: c.id, name: c.name, changes });
}

const withUnit = collaborators.filter((c) => c.unitId && units.has(c.unitId)).length;
const counts = { area: 0, team: 0, leader: 0 };
for (const u of updates) for (const ch of u.changes) counts[ch.field] += 1;

console.log(`${collaborators.length} colaboradores · ${withUnit} com unidade · ${units.size} unidades`);
console.log(`${updates.length} pessoas mudariam · área ${counts.area} · equipe ${counts.team} · líder ${counts.leader}\n`);
const show = (v) => (v === null ? '∅' : v === '' ? "''" : v);
for (const u of [...updates].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'))) {
  console.log(`- ${u.name}: ${u.changes.map((ch) => `${ch.field} ${show(ch.oldValue)} → ${show(ch.newValue)}`).join(' | ')}`);
}

// --- Consulta Pessoal: referências de área/equipe gravadas -------------------------------------
const after = collaborators.map((c) => ({ ...c, ...(derivedById.get(c.id) ?? {}) }));
const countBy = (people, field, label) => people.filter((p) => !isBlankLabel(p[field]) && norm(p[field]) === norm(label)).length;
const refs = [];
for (const d of linksSnap.docs) {
  const v = d.data();
  const a = v.audience ?? {};
  if (a.everyone) continue;
  for (const label of Array.isArray(a.areas) ? a.areas : []) refs.push({ where: `link "${v.title}" (${d.id}) · Público área`, field: 'area', label });
  for (const label of Array.isArray(a.teams) ? a.teams : []) refs.push({ where: `link "${v.title}" (${d.id}) · Público equipe`, field: 'team', label });
}
for (const d of typesSnap.docs) {
  const v = d.data();
  for (const label of Array.isArray(v.adminAreas) ? v.adminAreas : []) refs.push({ where: `tipo "${v.name}" (${d.id}) · admins por área`, field: 'area', label });
}
console.log(`\nConsulta Pessoal: ${linksSnap.size} links, ${typesSnap.size} tipos, ${refs.length} referências de área/equipe`);
for (const r of refs) {
  const before = countBy(collaborators, r.field, r.label);
  const now = countBy(after, r.field, r.label);
  const flag = now === 0 ? '  <-- DEIXA DE CASAR' : now !== before ? '  (muda)' : '';
  console.log(`- ${r.where}: "${r.label}" · ${before} → ${now} pessoas${flag}`);
}

if (!APPLY) {
  console.log('\nSimulação. Rode com --apply para gravar.');
  process.exit(0);
}

const now = new Date().toISOString();
for (let i = 0; i < updates.length; i += PEOPLE_PER_BATCH) {
  const batch = db.batch();
  for (const { id, name, changes } of updates.slice(i, i + PEOPLE_PER_BATCH)) {
    batch.update(db.collection('collaborators').doc(id), Object.fromEntries(changes.map((c) => [c.field, c.newValue])));
    batch.create(db.collection('collaborator_logs').doc(), {
      collaboratorId: id,
      collaboratorName: name ?? '',
      updatedBy: 'script:sync-org-derived-fields',
      updatedAt: now,
      source: 'org-derived',
      changes,
    });
  }
  await batch.commit();
}
if (updates.length) await db.collection('systemSettings').doc('config').update({ collaboratorTableVersion: FieldValue.increment(1) });
console.log(`\nGravado: ${updates.length} pessoas.`);

/**
 * ADR 0001: gestor por referência. Para cada colaborador sem `leaderIdVeneto`, procura o nome do
 * campo `leader` (como na planilha do RH) no próprio cadastro e grava o `idVeneto` do gestor.
 *
 * Só grava quando há exatamente uma pessoa com aquele nome (sem acento, sem caixa). Os demais
 * casos (nome não encontrado, homônimos, "—") vão para um CSV para o RH resolver pela tela de
 * colaboradores ("Gestor no organograma") ou pela planilha "Atualizar perfis" (coluna ID Gestor).
 *
 * Idempotente: quem já tem `leaderIdVeneto` não é tocado. `leader` (nome) não muda.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-leader-to-idveneto.mjs            # simulação + CSV
 *   node --env-file=.env.local scripts/migrate-leader-to-idveneto.mjs --apply    # grava
 */
import { writeFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const REPORT = `gestores-para-revisar-${new Date().toISOString().slice(0, 10)}.csv`;

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

const norm = (s = '') =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const docs = (await db.collection('collaborators').get()).docs;
const byName = new Map();
for (const d of docs) {
  const key = norm(d.get('name'));
  byName.set(key, [...(byName.get(key) ?? []), d]);
}

const writes = [];
const review = [];
let alreadySet = 0;

for (const d of docs) {
  if (String(d.get('leaderIdVeneto') ?? '').trim()) {
    alreadySet += 1;
    continue;
  }
  const leader = String(d.get('leader') ?? '').trim();
  const base = { id: d.get('idVeneto'), nome: d.get('name'), lider: leader };
  if (!leader || leader === '—' || leader === '-') {
    review.push({ ...base, motivo: 'sem líder no cadastro' });
    continue;
  }
  const matches = (byName.get(norm(leader)) ?? []).filter((m) => m.id !== d.id);
  if (matches.length === 1 && String(matches[0].get('idVeneto') ?? '').trim()) {
    writes.push([d.ref, String(matches[0].get('idVeneto')).trim(), base]);
  } else {
    review.push({ ...base, motivo: matches.length === 0 ? 'nome do líder não encontrado no cadastro' : `${matches.length} pessoas com esse nome` });
  }
}

console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — ${docs.length} colaboradores`);
console.log(`  ${writes.length} recebem o gestor pelo nome · ${alreadySet} já tinham · ${review.length} para o RH revisar`);
for (const [, idGestor, b] of writes.slice(0, 10)) console.log(`  + ${b.nome} → gestor ${b.lider} (ID ${idGestor})`);
if (writes.length > 10) console.log(`  … e mais ${writes.length - 10}`);

writeFileSync(REPORT, ['ID,Nome,Líder (como no cadastro),Motivo', ...review.map((r) => [r.id, r.nome, r.lider, r.motivo].map(csv).join(','))].join('\n'), 'utf8');
console.log(`  Lista para revisão: ${REPORT}`);

if (!APPLY) {
  console.log('\nNada gravado. Rode com --apply para gravar.');
  process.exit(0);
}
const now = new Date().toISOString();
for (let i = 0; i < writes.length; i += 200) {
  const batch = db.batch();
  for (const [ref, idGestor, b] of writes.slice(i, i + 200)) {
    batch.update(ref, { leaderIdVeneto: idGestor });
    batch.create(db.collection('collaborator_logs').doc(), {
      collaboratorId: ref.id,
      collaboratorName: b.nome ?? '',
      updatedBy: 'script:migrate-leader-to-idveneto',
      updatedAt: now,
      source: 'adr-0001-migration',
      changes: [{ field: 'leaderIdVeneto', oldValue: null, newValue: idGestor }],
    });
  }
  await batch.commit();
}
console.log(`\nOK: ${writes.length} colaboradores com leaderIdVeneto.`);

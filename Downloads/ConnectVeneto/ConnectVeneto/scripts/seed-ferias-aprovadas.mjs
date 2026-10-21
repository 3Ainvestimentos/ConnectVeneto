/**
 * Lança férias já aprovadas (fora do Connect) como registros oficiais em `vacations`, para
 * aparecerem na Home e nos Perfis. A pessoa é achada pelo ID Veneto; o registro usa o
 * `authUid` dela (mesmo formato que a aprovação pelo Connect grava).
 *
 * Idempotente: o id do documento é `import-<idVeneto>-<início>`; rodar de novo atualiza.
 * `businessDays` = dias úteis (seg–sex) do período, sem descontar feriados.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-ferias-aprovadas.mjs            # simulação
 *   node --env-file=.env.local scripts/seed-ferias-aprovadas.mjs --apply    # grava
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

/** Férias informadas pelo Victor em 2026-10-21 (já aprovadas). */
const FERIAS = [
  { idVeneto: 'RLM5', start: '2026-12-21', end: '2027-01-03' },
  { idVeneto: 'LNM5', start: '2027-01-04', end: '2027-01-18' },
  { idVeneto: 'GCC5', start: '2026-11-23', end: '2026-12-10' },
  { idVeneto: 'BLB5', start: '2026-11-03', end: '2026-11-09' },
  { idVeneto: 'FLD5', start: '2026-10-21', end: '2026-10-28' },
  { idVeneto: 'VCS5', start: '2026-11-16', end: '2026-11-24' },
];

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

function businessDays(start, end) {
  let n = 0;
  for (let d = new Date(`${start}T12:00:00`); d <= new Date(`${end}T12:00:00`); d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

const collaborators = (await db.collection('collaborators').get()).docs;
const now = new Date().toISOString();
const writes = [];
let problems = 0;

console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — ${FERIAS.length} períodos de férias em \`vacations\``);
for (const f of FERIAS) {
  const c = collaborators.find((d) => String(d.get('idVeneto') ?? '').trim() === f.idVeneto);
  if (!c) {
    console.log(`  ! ${f.idVeneto}: não encontrado no cadastro`);
    problems += 1;
    continue;
  }
  const uid = String(c.get('authUid') ?? '').trim();
  if (!uid) {
    console.log(`  ! ${c.get('name')}: sem authUid (nunca entrou no Connect); não dá para ligar o registro`);
    problems += 1;
    continue;
  }
  if (f.end < f.start) {
    console.log(`  ! ${c.get('name')}: fim antes do início`);
    problems += 1;
    continue;
  }
  const id = `import-${f.idVeneto}-${f.start}`;
  const ref = db.collection('vacations').doc(id);
  const exists = (await ref.get()).exists;
  const doc = {
    collaboratorUid: uid,
    collaboratorName: c.get('name'),
    startDate: f.start,
    endDate: f.end,
    businessDays: businessDays(f.start, f.end),
    source: 'import-2026-10-21',
    updatedAt: now,
    ...(exists ? {} : { createdAt: now }),
  };
  writes.push([ref, doc]);
  console.log(`  ${exists ? '~ atualiza' : '+ cria'} ${c.get('name')}: ${f.start} a ${f.end} (${doc.businessDays} dias úteis)`);
}

if (!APPLY) {
  console.log(`\n${problems ? `${problems} com problema. ` : ''}Nada gravado. Rode com --apply para gravar.`);
  process.exit(0);
}
const batch = db.batch();
for (const [ref, doc] of writes) batch.set(ref, doc, { merge: true });
await batch.commit();
console.log(`\nOK: ${writes.length} registros em vacations.`);

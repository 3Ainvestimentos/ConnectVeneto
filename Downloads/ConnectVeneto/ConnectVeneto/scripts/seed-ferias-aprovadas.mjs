/**
 * Lança férias já aprovadas fora do Connect só para EXIBIÇÃO no Hub (Home e Perfis), em
 * `hubVacations`. Não entra em `vacations` (registro oficial), então não mexe no saldo de férias
 * nem no fluxo de solicitação/aprovação. Coleção fechada ao navegador (regra padrão); quem lê é
 * `GET /api/feed/vacations`, pelo servidor.
 *
 * A pessoa é achada pelo ID Veneto; o registro guarda o `authUid` dela para a Home ligar ao Perfil.
 * Idempotente: o id do documento é `<idVeneto>-<início>`; rodar de novo atualiza.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-ferias-aprovadas.mjs            # simulação
 *   node --env-file=.env.local scripts/seed-ferias-aprovadas.mjs --apply    # grava
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const COLLECTION = 'hubVacations';

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

const collaborators = (await db.collection('collaborators').get()).docs;
const now = new Date().toISOString();
const writes = [];
let problems = 0;

console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — ${FERIAS.length} períodos de férias em \`${COLLECTION}\` (só exibição, fora do saldo)`);
for (const f of FERIAS) {
  const c = collaborators.find((d) => String(d.get('idVeneto') ?? '').trim() === f.idVeneto);
  if (!c) {
    console.log(`  ! ${f.idVeneto}: não encontrado no cadastro`);
    problems += 1;
    continue;
  }
  if (f.end < f.start) {
    console.log(`  ! ${c.get('name')}: fim antes do início`);
    problems += 1;
    continue;
  }
  const ref = db.collection(COLLECTION).doc(`${f.idVeneto}-${f.start}`);
  const exists = (await ref.get()).exists;
  const uid = String(c.get('authUid') ?? '').trim();
  writes.push([
    ref,
    {
      idVeneto: f.idVeneto,
      uid,
      name: c.get('name'),
      startDate: f.start,
      endDate: f.end,
      source: 'informado-2026-10-21',
      updatedAt: now,
      ...(exists ? {} : { createdAt: now }),
    },
  ]);
  console.log(`  ${exists ? '~ atualiza' : '+ cria'} ${c.get('name')}: ${f.start} a ${f.end}${uid ? '' : ' (sem authUid: aparece sem link para o Perfil)'}`);
}

if (!APPLY) {
  console.log(`\n${problems ? `${problems} com problema. ` : ''}Nada gravado. Rode com --apply para gravar.`);
  process.exit(0);
}
const batch = db.batch();
for (const [ref, doc] of writes) batch.set(ref, doc, { merge: true });
await batch.commit();
console.log(`\nOK: ${writes.length} registros em ${COLLECTION}.`);

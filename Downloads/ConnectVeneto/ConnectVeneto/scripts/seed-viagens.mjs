/**
 * Lança viagens informadas pelo Victor em `leaderTrips` (a mesma base do "Registrar viagem" e do
 * admin de Viagens). A pessoa é achada pelo ID Veneto e fica como responsável (`responsavelUid` =
 * o authUid dela), então ela mesma pode editar ou cancelar depois, como se tivesse registrado.
 *
 * Idempotente: id do documento `import-<idVeneto>-<ida>`; rodar de novo atualiza.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-viagens.mjs            # simulação
 *   node --env-file=.env.local scripts/seed-viagens.mjs --apply    # grava
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

/** Viagens informadas em 2026-10-21. */
const VIAGENS = [
  { idVeneto: 'CHC5', destino: 'São Paulo - SP', ida: '2026-10-28', volta: '2026-10-30' },
  { idVeneto: 'CHC5', destino: 'São Paulo - SP', ida: '2026-11-05', volta: '2026-11-06' },
  { idVeneto: 'CHC5', destino: 'Porto Alegre - RS', ida: '2026-11-11', volta: '2026-11-13' },
  { idVeneto: 'FLD5', destino: 'São Paulo - SP', ida: '2026-10-29', volta: '2026-10-30' },
  { idVeneto: 'FLD5', destino: 'Porto Alegre - RS', ida: '2026-11-11', volta: '2026-11-13' },
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

console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — ${VIAGENS.length} viagens em \`leaderTrips\``);
for (const v of VIAGENS) {
  const c = collaborators.find((d) => String(d.get('idVeneto') ?? '').trim() === v.idVeneto);
  const uid = String(c?.get('authUid') ?? '').trim();
  if (!c || !uid) {
    console.log(`  ! ${v.idVeneto}: ${c ? 'sem authUid' : 'não encontrado no cadastro'}`);
    problems += 1;
    continue;
  }
  if (v.volta < v.ida) {
    console.log(`  ! ${c.get('name')}: volta antes da ida`);
    problems += 1;
    continue;
  }
  const ref = db.collection('leaderTrips').doc(`import-${v.idVeneto}-${v.ida}`);
  const exists = (await ref.get()).exists;
  writes.push([
    ref,
    {
      leaderName: c.get('name'),
      destinationBranch: v.destino,
      startDate: v.ida,
      endDate: v.volta,
      responsavelUid: uid,
      responsavelNome: c.get('name'),
      updatedAt: now,
      ...(exists ? {} : { createdAt: now }),
    },
  ]);
  console.log(`  ${exists ? '~ atualiza' : '+ cria'} ${c.get('name')}: ${v.destino}, ${v.ida} a ${v.volta}`);
}

if (!APPLY) {
  console.log(`\n${problems ? `${problems} com problema. ` : ''}Nada gravado. Rode com --apply para gravar.`);
  process.exit(0);
}
const batch = db.batch();
for (const [ref, doc] of writes) batch.set(ref, doc, { merge: true });
await batch.commit();
console.log(`\nOK: ${writes.length} viagens em leaderTrips.`);

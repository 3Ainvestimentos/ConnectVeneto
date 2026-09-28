/**
 * Grava o registro padrão de módulos (src/config/hub-modules.seed.json) na coleção
 * `hubModules`. Idempotente: só cria documentos que ainda não existem, a menos que
 * se passe --overwrite.
 *
 * Alternativa sem terminal: aba Admin → Módulos → "Gravar registro padrão" faz o
 * mesmo que este script sem --overwrite.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-hub-modules.mjs              # dry-run
 *   node --env-file=.env.local scripts/seed-hub-modules.mjs --apply
 *   node --env-file=.env.local scripts/seed-hub-modules.mjs --apply --overwrite
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');
const COLLECTION = 'hubModules';

const seed = JSON.parse(readFileSync(new URL('../src/config/hub-modules.seed.json', import.meta.url), 'utf8'));

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
const now = new Date().toISOString();

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'}${OVERWRITE ? ' (overwrite)' : ''} — ${seed.length} módulos no seed`);

const batch = db.batch();
let writes = 0;

for (const mod of seed) {
  const ref = db.collection(COLLECTION).doc(mod.id);
  const snap = await ref.get();
  if (snap.exists && !OVERWRITE) {
    console.log(`  = ${mod.id} já existe (mantido)`);
    continue;
  }
  const data = {
    ...mod,
    ...(snap.exists ? {} : { createdAt: now }),
    updatedAt: now,
    updatedBy: 'scripts/seed-hub-modules.mjs',
  };
  console.log(`  ${snap.exists ? '~ sobrescreve' : '+ cria'} ${mod.id} (ordem ${mod.order}, ${mod.kind}${mod.url ? `, ${mod.url}` : ''})`);
  batch.set(ref, data);
  writes += 1;
}

if (!APPLY) {
  console.log(`\n${writes} escrita(s) pendente(s). Rode com --apply para gravar.`);
  process.exit(0);
}

if (writes) await batch.commit();
console.log(`\nOK: ${writes} documento(s) gravado(s).`);

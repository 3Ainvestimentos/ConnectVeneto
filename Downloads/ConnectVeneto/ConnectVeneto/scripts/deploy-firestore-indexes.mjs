/**
 * Cria no Firestore os índices compostos de firestore.indexes.json que ainda não existem,
 * via Firestore Admin API e o service account de FIREBASE_ADMIN_*. Não depende de
 * `firebase login`: o firebase-tools global desta máquina está quebrado e o usuário não
 * tem acesso ao console.
 *
 * Só CRIA. Nunca apaga um índice que existe em produção e falta no arquivo:
 * `firebase deploy --only firestore:indexes` pode propor isso, e um índice apagado
 * derruba a consulta que dependia dele.
 *
 * Usage:
 *   node --env-file=.env.local scripts/deploy-firestore-indexes.mjs          # dry-run
 *   node --env-file=.env.local scripts/deploy-firestore-indexes.mjs --apply  # cria os que faltam
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;
const NETWORK_TIMEOUT_MS = 30_000;

if (!PROJECT_ID) {
  console.error('FIREBASE_ADMIN_PROJECT_ID ausente. Use --env-file=.env.local');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups`;
let headers;

async function api(path, init) {
  if (!headers) {
    const { access_token } = await getApps()[0].options.credential.getAccessToken();
    headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
  }
  const res = await fetch(`${BASE}/${path}`, { ...init, headers, signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> HTTP ${res.status}: ${JSON.stringify(body).slice(0, 600)}`);
  return body;
}

/** Assinatura comparável de um índice (ignora o campo implícito __name__). */
const signature = (queryScope, fields) =>
  `${queryScope}|` +
  fields
    .filter((f) => f.fieldPath !== '__name__')
    .map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig}`)
    .join(',');

async function run() {
  console.log(`Projeto: ${PROJECT_ID}`);
  console.log(APPLY ? 'Modo: APPLY (vai criar os que faltam)' : 'Modo: dry-run');

  const { indexes = [] } = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));
  const byCollection = new Map();
  for (const idx of indexes) {
    if (!byCollection.has(idx.collectionGroup)) byCollection.set(idx.collectionGroup, []);
    byCollection.get(idx.collectionGroup).push(idx);
  }

  let missing = 0;
  for (const [collection, wanted] of byCollection) {
    const { indexes: live = [] } = await api(`${collection}/indexes`);
    const liveSigs = new Map(live.map((i) => [signature(i.queryScope, i.fields), i.state]));

    for (const idx of wanted) {
      const sig = signature(idx.queryScope ?? 'COLLECTION', idx.fields);
      const label = `${collection} (${idx.fields.map((f) => `${f.fieldPath} ${f.order ?? f.arrayConfig}`).join(', ')})`;
      if (liveSigs.has(sig)) {
        console.log(`  = ${label} — já existe [${liveSigs.get(sig)}]`);
        continue;
      }
      missing++;
      if (!APPLY) {
        console.log(`  + ${label} — faltando (dry-run)`);
        continue;
      }
      const op = await api(`${collection}/indexes`, {
        method: 'POST',
        body: JSON.stringify({ queryScope: idx.queryScope ?? 'COLLECTION', fields: idx.fields }),
      });
      console.log(`  ✅ ${label} — criação iniciada (${op.name?.split('/').pop() ?? 'operação'}); leva alguns minutos para ficar READY`);
    }
  }

  console.log(missing === 0 ? '\nNada a criar.' : APPLY ? '\nConcluído.' : `\n${missing} índice(s) faltando — repita com --apply`);
}

run().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exitCode = 1;
});

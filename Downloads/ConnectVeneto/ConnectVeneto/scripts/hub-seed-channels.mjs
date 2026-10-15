/**
 * Cria os canais iniciais do Hub de Comunicação (`hubChannels`). Idempotente: canal que já
 * existe é mantido (use --overwrite para regravar nome/ordem/semeado, preservando publicadores).
 *
 * A Comunicação (quem tem `canManageContent`) publica em todos os canais; `publisherEmails`
 * libera outras pessoas canal a canal e começa vazio.
 *
 * Usage:
 *   node --env-file=.env.local scripts/hub-seed-channels.mjs --owner=nome@venetomfo.com.br
 *   node --env-file=.env.local scripts/hub-seed-channels.mjs --owner=nome@venetomfo.com.br --apply
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');
const OWNER = process.argv.find((a) => a.startsWith('--owner='))?.split('=')[1]?.trim().toLowerCase();
const COLLECTION = 'hubChannels';

if (!OWNER || !OWNER.endsWith('@venetomfo.com.br')) {
  console.error('Informe o dono padrão dos canais: --owner=nome@venetomfo.com.br');
  process.exit(1);
}

// `seeded`: entra no feed de todos até a pessoa deixar de seguir.
const CHANNELS = [
  { id: 'institucional', name: 'Institucional', seeded: true },
  { id: 'eventos', name: 'Eventos', seeded: true },
  { id: 'tecnologia', name: 'Tecnologia', seeded: true },
  { id: 'mercado', name: 'Mercado', seeded: true },
  { id: 'vagas', name: 'Vagas e indicações', seeded: true },
  { id: 'compliance', name: 'Compliance', seeded: true },
  { id: 'bem-estar', name: 'Bem-estar', seeded: false },
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
const now = new Date().toISOString();
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'}${OVERWRITE ? ' (overwrite)' : ''} — ${CHANNELS.length} canais, dono padrão ${OWNER}`);

const batch = db.batch();
let writes = 0;
for (const [order, c] of CHANNELS.entries()) {
  const ref = db.collection(COLLECTION).doc(c.id);
  const snap = await ref.get();
  if (snap.exists && !OVERWRITE) {
    console.log(`  = ${c.id} já existe (mantido)`);
    continue;
  }
  const prev = snap.exists ? snap.data() : {};
  batch.set(ref, {
    id: c.id,
    name: c.name,
    ownerEmail: prev.ownerEmail ?? OWNER,
    publisherEmails: prev.publisherEmails ?? [],
    seeded: c.seeded,
    order,
    active: true,
    createdAt: prev.createdAt ?? now,
    updatedAt: now,
  });
  console.log(`  ${snap.exists ? '~ regrava' : '+ cria'} ${c.id} (${c.name})`);
  writes += 1;
}

if (!APPLY) {
  console.log(`\n${writes} escrita(s) pendente(s). Rode com --apply para gravar.`);
  process.exit(0);
}
if (writes) await batch.commit();
console.log(`\nOK: ${writes} canal(is) gravado(s).`);

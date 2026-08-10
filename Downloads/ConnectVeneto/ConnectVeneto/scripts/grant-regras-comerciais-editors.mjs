/**
 * Concede `permissions.canManageRegrasComerciais` — editar as imagens do carrossel
 * "Apresentação — Mix de Serviços" em /regras-comerciais — para a lista abaixo.
 *
 * Só liga essa flag; nenhuma outra permissão é tocada.
 *
 * Usage:
 *   node --env-file=.env.local scripts/grant-regras-comerciais-editors.mjs --dry-run
 *   node --env-file=.env.local scripts/grant-regras-comerciais-editors.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

const TARGET_EMAILS = [
  'victor.santos@venetomfo.com.br',  // Victor Carneiro dos Santos
  'patrick.correa@venetomfo.com.br', // Patrick Corrêa Negreiros
  'paulo.ribeiro@venetomfo.com.br',  // Paulo Victor Ferreira Ribeiro
  'fernando@venetomfo.com.br',       // Fernando Luiz Damasceno
  'ana.daldegan@venetomfo.com.br',   // Ana Catharina Lopes Daldegan Cardoso
];

const PERMISSION_KEY = 'canManageRegrasComerciais';

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

async function run() {
  const collaborators = db.collection('collaborators');
  const found = [];
  const missing = [];

  for (const email of TARGET_EMAILS) {
    const snap = await collaborators.where('email', '==', email).limit(1).get();
    if (snap.empty) {
      missing.push(email);
      continue;
    }
    const doc = snap.docs[0];
    found.push({
      ref: doc.ref,
      email,
      name: doc.data().name ?? '(sem nome)',
      already: doc.data().permissions?.[PERMISSION_KEY] === true,
    });
  }

  console.log(`Colaboradores encontrados: ${found.length}/${TARGET_EMAILS.length}`);
  for (const c of found) {
    console.log(`  - ${c.name} <${c.email}>${c.already ? ' (já tinha a permissão)' : ''}`);
  }

  if (missing.length) {
    console.log(`\n⚠️  Não encontrados em /collaborators (nenhuma ação):`);
    for (const email of missing) console.log(`  - ${email}`);
  }

  const toUpdate = found.filter((c) => !c.already);
  console.log(`\nSerão atualizados: ${toUpdate.length}`);

  if (DRY_RUN) {
    console.log('(dry-run: nada foi gravado no Firestore)');
    return;
  }

  if (!toUpdate.length) {
    console.log('Nada a fazer.');
    return;
  }

  const batch = db.batch();
  for (const c of toUpdate) {
    batch.update(c.ref, { [`permissions.${PERMISSION_KEY}`]: true });
  }
  await batch.commit();

  console.log(`\n✅ ${PERMISSION_KEY} = true concedida a ${toUpdate.length} colaborador(es).`);

  if (missing.length) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

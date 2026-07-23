/**
 * Script único: corrige o icone quebrado do Quick Link de e-mail da Hype
 * Tecnologia (hotlink externo do Wikimedia) para o icone local em
 * public/quicklinks/hype-email-icon.svg.
 * Usage: node scripts/fix-hype-email-icon.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'quickLinks';
const TARGET_LINK = 'mailto:atendimento@hypetecnologia.com.br';
const NEW_IMAGE_URL = '/quicklinks/hype-email-icon.svg';

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
  const snap = await db
    .collection(COLLECTION_NAME)
    .where('link', '==', TARGET_LINK)
    .get();

  if (snap.empty) {
    console.log(`⚠️  Nenhum Quick Link encontrado com o link "${TARGET_LINK}".`);
    return;
  }

  for (const doc of snap.docs) {
    if (doc.data().imageUrl === NEW_IMAGE_URL) {
      console.log(`ℹ️  Quick Link "${doc.id}" já usa o ícone local, pulando.`);
      continue;
    }
    await doc.ref.update({ imageUrl: NEW_IMAGE_URL });
    console.log(`✅ Quick Link "${doc.id}" atualizado para o ícone local.`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

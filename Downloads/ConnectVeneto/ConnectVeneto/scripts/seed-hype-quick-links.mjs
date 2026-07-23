/**
 * Script único: cria os Quick Links de contato com a Hype Tecnologia
 * (WhatsApp e e-mail), antes gerenciados dentro de Solicitações > TI/Suporte.
 * Usage: node scripts/seed-hype-quick-links.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'quickLinks';

const WHATSAPP_ICON = 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg';
const EMAIL_ICON = 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Circle-icons-mail.svg';

const NEW_LINKS = [
  {
    name: 'WhatsApp - Hype Tecnologia',
    imageUrl: WHATSAPP_ICON,
    link: 'https://api.whatsapp.com/send/?phone=553125950463&text&type=phone_number&app_absent=0',
    isUserSpecific: false,
    recipientIds: ['all'],
  },
  {
    name: 'E-mail - Hype Tecnologia',
    imageUrl: EMAIL_ICON,
    link: 'mailto:atendimento@hypetecnologia.com.br',
    isUserSpecific: false,
    recipientIds: ['all'],
  },
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

async function run() {
  const snap = await db.collection(COLLECTION_NAME).get();
  const maxOrder = snap.docs.reduce((max, doc) => Math.max(max, doc.data().order ?? 0), 0);

  for (const [index, linkData] of NEW_LINKS.entries()) {
    const existing = snap.docs.find((doc) => doc.data().link === linkData.link);
    if (existing) {
      console.log(`⚠️  Já existe um Quick Link com o link "${linkData.link}" (id: ${existing.id}), pulando.`);
      continue;
    }

    const docRef = await db.collection(COLLECTION_NAME).add({
      ...linkData,
      order: maxOrder + index + 1,
    });
    console.log(`✅ Quick Link criado: "${linkData.name}" (id: ${docRef.id})`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

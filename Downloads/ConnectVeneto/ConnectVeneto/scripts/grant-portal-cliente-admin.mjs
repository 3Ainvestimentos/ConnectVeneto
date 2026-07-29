/**
 * Script temporário: concede acesso de admin ao Portal do Cliente.
 * Usage: node scripts/grant-portal-cliente-admin.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TARGET_EMAIL = 'victor.santos@venetomfo.com.br';
const MODULE_ID    = 'portal-cliente';

const ADMIN_PERMISSIONS = [
  'portal-cliente:view',
  'portal-cliente:manage',
];

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function run() {
  const snap = await db.collection('collaborators')
    .where('email', '==', TARGET_EMAIL)
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(`❌ Colaborador não encontrado: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const doc = snap.docs[0];
  const data = doc.data();

  const updatedPermissions = {
    ...(data.permissions ?? {}),
    canViewPortalCliente: true,
  };

  const updatedModulePerms = {
    ...(data.modulePermissions ?? {}),
    [MODULE_ID]: ADMIN_PERMISSIONS,
  };

  await doc.ref.update({
    permissions:       updatedPermissions,
    modulePermissions: updatedModulePerms,
  });

  console.log(`✅ Permissões concedidas para ${TARGET_EMAIL}`);
  console.log('   permissions.canViewPortalCliente = true');
  console.log('   modulePermissions[portal-cliente] =', ADMIN_PERMISSIONS);
}

run().catch(err => { console.error(err); process.exit(1); });

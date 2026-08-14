/**
 * Somente leitura: panorama de quem tem acesso à Biblioteca Comercial.
 *
 * Mostra super admins (que passam por cima das flags), quem tem cada flag
 * ligada, e o cruzamento com `accessType` — útil para decidir a quem conceder
 * acesso antes de anunciar a feature.
 *
 * Usage:
 *   node --env-file=.env.local scripts/audit-biblioteca-comercial-permissions.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const settings = await db.collection('systemSettings').doc('config').get();
const superAdmins = (settings.data()?.superAdminEmails ?? []).map((e) => String(e).toLowerCase());

const snapshot = await db.collection('collaborators').get();
const collaborators = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

const canView = [];
const canManage = [];
const byAccessType = new Map();

for (const collaborator of collaborators) {
  const permissions = collaborator.permissions ?? {};
  const accessType = collaborator.accessType ?? '(sem accessType)';

  const bucket = byAccessType.get(accessType) ?? { total: 0, view: 0, manage: 0 };
  bucket.total += 1;
  if (permissions.canViewBibliotecaComercial === true) bucket.view += 1;
  if (permissions.canManageBibliotecaComercial === true) bucket.manage += 1;
  byAccessType.set(accessType, bucket);

  if (permissions.canViewBibliotecaComercial === true) {
    canView.push(`${collaborator.name} <${collaborator.email}>`);
  }
  if (permissions.canManageBibliotecaComercial === true) {
    canManage.push(`${collaborator.name} <${collaborator.email}>`);
  }
}

console.log(`total de colaboradores: ${collaborators.length}`);

console.log(`\n=== super admins (${superAdmins.length}) — acesso total, ignoram as flags ===`);
for (const email of superAdmins) {
  const match = collaborators.find((c) => String(c.email).toLowerCase() === email);
  console.log(`  ${email}${match ? ` — ${match.name}` : ' — (sem colaborador correspondente)'}`);
}

console.log(`\n=== canViewBibliotecaComercial = true (${canView.length}) ===`);
console.log(canView.length ? canView.map((x) => `  ${x}`).join('\n') : '  (ninguém)');

console.log(`\n=== canManageBibliotecaComercial = true (${canManage.length}) ===`);
console.log(canManage.length ? canManage.map((x) => `  ${x}`).join('\n') : '  (ninguém)');

console.log('\n=== por accessType (total | com view | com manage) ===');
for (const [accessType, bucket] of [...byAccessType.entries()].sort()) {
  console.log(
    `  ${accessType.padEnd(20)} ${String(bucket.total).padStart(4)} | ${String(bucket.view).padStart(4)} | ${String(bucket.manage).padStart(4)}`
  );
}

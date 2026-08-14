/**
 * Somente leitura: mostra se um e-mail tem acesso à Biblioteca Comercial —
 * super admin, flags de permissão do colaborador — e os últimos eventos de
 * auditoria relacionados. Serve para explicar 403 e "o botão não aparece".
 *
 * Usage:
 *   node --env-file=.env.local scripts/check-biblioteca-comercial-access.mjs alguem@venetomfo.com.br
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
  console.error('Informe o e-mail: node --env-file=.env.local scripts/check-biblioteca-comercial-access.mjs alguem@venetomfo.com.br');
  process.exit(1);
}

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
const isSuperAdmin = superAdmins.includes(email);

console.log(`e-mail: ${email}`);
console.log(`super admin: ${isSuperAdmin ? 'SIM (passa em tudo)' : 'não'}`);

const byEmail = await db.collection('collaborators').where('email', '==', email).limit(1).get();
if (byEmail.empty) {
  console.log('colaborador: NÃO ENCONTRADO por e-mail em `collaborators`');
} else {
  const data = byEmail.docs[0].data();
  const permissions = data.permissions ?? {};
  console.log(`colaborador: ${data.name} (accessType: ${data.accessType ?? '—'})`);
  console.log(`  authUid vinculado: ${data.authUid ? 'sim' : 'NÃO (o vínculo forte está ausente)'}`);
  console.log('  permissões relevantes:');
  for (const key of [
    'canViewDocuments',
    'canViewBibliotecaComercial',
    'canManageBibliotecaComercial',
  ]) {
    console.log(`    ${key}: ${permissions[key] === true ? 'SIM' : 'não'}`);
  }
}

// Sem `where` + `orderBy` juntos: essa combinação exigiria um índice composto que
// o projeto não tem (o único índice de audit_logs é eventType+timestamp).
console.log('\núltimos eventos de auditoria (mais recentes primeiro):');
const logs = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(12).get();

if (logs.empty) {
  console.log('  (nenhum)');
}
for (const doc of logs.docs) {
  const data = doc.data();
  const details = data.details ?? {};
  console.log(
    `  ${data.timestamp}  ${data.eventType}  source=${details.source ?? '—'}  ${JSON.stringify(details.term ?? details.documentName ?? '')}`
  );
}

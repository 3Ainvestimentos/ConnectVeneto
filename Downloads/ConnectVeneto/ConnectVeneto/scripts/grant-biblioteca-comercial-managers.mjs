/**
 * Concede acesso à Biblioteca Comercial:
 * - `canViewBibliotecaComercial` para TODOS os colaboradores (acervo aberto à empresa);
 * - `canManageBibliotecaComercial` apenas para a lista de curadores abaixo.
 *
 * Ninguém é revogado: quem já tem gestão continua tendo, mesmo fora da lista.
 * Rodar de novo não muda nada (idempotente).
 *
 * Padrão dos scripts deste repo: dry-run por default, grava só com --apply.
 *
 * Usage:
 *   node --env-file=.env.local scripts/grant-biblioteca-comercial-managers.mjs
 *   node --env-file=.env.local scripts/grant-biblioteca-comercial-managers.mjs --apply
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

/** Curadores que podem publicar documentos. E-mails em minúsculas. */
const MANAGER_EMAILS = [
  'ana.daldegan@venetomfo.com.br',
  'patrick.correa@venetomfo.com.br',
  'fernando@venetomfo.com.br',
  'carlos@venetomfo.com.br',
  'paulo.ribeiro@venetomfo.com.br',
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
const snapshot = await db.collection('collaborators').get();

console.log(`Projeto: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
console.log(APPLY ? 'Modo: APPLY (vai gravar)' : 'Modo: dry-run');
console.log(`Colaboradores: ${snapshot.size}`);

const managerSet = new Set(MANAGER_EMAILS.map((email) => email.toLowerCase()));
const found = new Set();

const grantedView = [];
const grantedManage = [];
let batch = db.batch();
let pending = 0;
let committed = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const email = String(data.email ?? '').toLowerCase();
  const permissions = data.permissions ?? {};

  const shouldManage = managerSet.has(email);
  if (shouldManage) found.add(email);

  const needsView = permissions.canViewBibliotecaComercial !== true;
  const needsManage = shouldManage && permissions.canManageBibliotecaComercial !== true;

  if (!needsView && !needsManage) continue;

  if (needsView) grantedView.push(`${data.name} <${email}>`);
  if (needsManage) grantedManage.push(`${data.name} <${email}>`);

  if (!APPLY) continue;

  const update = {};
  if (needsView) update['permissions.canViewBibliotecaComercial'] = true;
  if (needsManage) update['permissions.canManageBibliotecaComercial'] = true;

  batch.update(doc.ref, update);
  pending += 1;

  // Firestore aceita no máximo 500 operações por batch.
  if (pending === 400) {
    await batch.commit();
    committed += pending;
    batch = db.batch();
    pending = 0;
  }
}

if (APPLY && pending > 0) {
  await batch.commit();
  committed += pending;
}

console.log(`\n=== visualização concedida (${grantedView.length}) ===`);
console.log(grantedView.length ? '  (lista longa omitida)' : '  (todos já tinham)');

console.log(`\n=== gestão concedida (${grantedManage.length}) ===`);
console.log(grantedManage.length ? grantedManage.map((x) => `  ${x}`).join('\n') : '  (todos já tinham)');

const missing = [...managerSet].filter((email) => !found.has(email));
if (missing.length > 0) {
  console.log('\n⚠️  curadores não encontrados em `collaborators`:');
  for (const email of missing) console.log(`  ${email}`);
}

console.log(
  APPLY
    ? `\n✅ ${committed} documento(s) atualizado(s).`
    : '\n(dry-run: nada gravado — repita com --apply)'
);

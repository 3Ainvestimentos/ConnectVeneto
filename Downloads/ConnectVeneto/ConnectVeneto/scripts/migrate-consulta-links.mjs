/**
 * Migra a Consulta Pessoal do cadastro do colaborador para a biblioteca de links:
 * - cria os tipos MESA e CX em `consultaLinkTypes` (ids fixos `mesa` e `cx`);
 * - cria em cada tipo um link Individual ("Planilha MESA", "Planilha CX"), que só
 *   aparece para quem tem URL própria;
 * - grava a URL de cada pessoa em `consultaLinkValues` (`<linkId>__<email>`).
 *
 * Idempotente: tipo existente não é tocado (admins definidos na tela continuam),
 * link e URL já migrados não são sobrescritos.
 * O campo antigo fica no cadastro como histórico.
 *
 * Padrão dos scripts deste repo: dry-run por default, grava só com --apply.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-consulta-links.mjs
 *   node --env-file=.env.local scripts/migrate-consulta-links.mjs --apply
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

const TYPES = [
  { id: 'mesa', name: 'MESA', description: 'Planilhas da Mesa', order: 0, linkId: 'mesa-planilha', title: 'Planilha MESA' },
  { id: 'cx', name: 'CX', description: 'Planilhas de CX', order: 1, linkId: 'cx-planilha', title: 'Planilha CX' },
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
const MIGRATED_BY = 'migracao@consulta-pessoal';

console.log(`Projeto: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
console.log(APPLY ? 'Modo: APPLY (vai gravar)' : 'Modo: dry-run');

const collaborators = await db.collection('collaborators').get();
const batch = db.batch();
let writes = 0;
const summary = {};

for (const type of TYPES) {
  const typeRef = db.collection('consultaLinkTypes').doc(type.id);
  if (!(await typeRef.get()).exists) {
    console.log(`+ tipo ${type.name}`);
    batch.set(typeRef, {
      name: type.name,
      description: type.description,
      adminEmails: [],
      adminAreas: [],
      order: type.order,
      createdAt: now,
      updatedAt: now,
      updatedByEmail: MIGRATED_BY,
    });
    writes++;
  }

  const urls = new Map();
  let invalid = 0;
  for (const doc of collaborators.docs) {
    const data = doc.data();
    const email = String(data.email ?? '').trim().toLowerCase();
    const url = String(data.consultaLinks?.[type.id] ?? '').trim();
    if (!email || !url) continue;
    if (!/^https?:\/\/\S+$/i.test(url)) {
      console.warn(`! ${email} ${type.name}: URL inválida, ignorada (${url.slice(0, 60)})`);
      invalid++;
      continue;
    }
    urls.set(email, url);
  }

  const linkRef = db.collection('consultaLinks').doc(type.linkId);
  if (!(await linkRef.get()).exists) {
    console.log(`+ link ${type.title} (Individual)`);
    batch.set(linkRef, {
      kind: 'individual',
      typeId: type.id,
      ownerEmail: null,
      title: type.title,
      url: '',
      description: '',
      audience: null,
      createdByEmail: MIGRATED_BY,
      createdAt: now,
      updatedByEmail: MIGRATED_BY,
      updatedAt: now,
    });
    writes++;
  }

  const existingValues = new Set(
    (await db.collection('consultaLinkValues').where('linkId', '==', type.linkId).get()).docs.map((doc) => doc.id)
  );
  let created = 0;
  for (const [email, url] of urls) {
    const valueId = `${type.linkId}__${email}`;
    if (existingValues.has(valueId)) continue;
    batch.set(db.collection('consultaLinkValues').doc(valueId), {
      linkId: type.linkId,
      typeId: type.id,
      ownerEmail: email,
      url,
      updatedAt: now,
      updatedByEmail: MIGRATED_BY,
    });
    created++;
    writes++;
  }
  summary[type.name] = { pessoas: urls.size, urlsNovas: created, jaMigradas: urls.size - created, invalidas: invalid };
}

console.table(summary);
console.log(`Gravações: ${writes}`);

if (APPLY && writes > 0) {
  await batch.commit();
  console.log('Gravado.');
} else if (!APPLY) {
  console.log('Nada gravado (dry-run). Rode com --apply para gravar.');
}

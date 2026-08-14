/**
 * Somente leitura: diagnóstico da Biblioteca Comercial.
 * Lista os metadados em `commercialDocuments`, os arquivos em
 * `biblioteca-comercial/` no Storage e as coleções existentes no Firestore.
 *
 * Separa os três cenários de "a biblioteca aparece vazia":
 * nada gravado; arquivo no Storage sem metadado (upload órfão); metadado em
 * coleção inesperada.
 *
 * Usage:
 *   node --env-file=.env.local scripts/list-commercial-docs.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const app = getApps()[0];
const db = getFirestore();

const snapshot = await db.collection('commercialDocuments').get();
console.log(`=== commercialDocuments: ${snapshot.size} documento(s) ===`);
for (const doc of snapshot.docs) {
  const data = doc.data();
  console.log('---');
  console.log('  id:', doc.id);
  console.log('  title:', JSON.stringify(data.title));
  console.log('  sourceType:', data.sourceType, '| fileType:', data.fileType);
  console.log('  storagePath:', data.storagePath ?? '(sem)');
  console.log('  createdAt:', data.createdAt);
  console.log('  campos:', Object.keys(data).sort().join(', '));
}

console.log('\n=== arquivos em biblioteca-comercial/ (Storage) ===');
try {
  const [files] = await getStorage(app)
    .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
    .getFiles({ prefix: 'biblioteca-comercial/' });
  if (files.length === 0) {
    console.log('  (nenhum arquivo)');
  }
  for (const file of files) {
    console.log(`  ${file.name}  (${file.metadata.size} bytes, ${file.metadata.timeCreated})`);
  }
} catch (error) {
  console.log('  falha ao listar Storage:', error.message);
}

console.log('\n=== coleções existentes no Firestore ===');
const collections = await db.listCollections();
console.log(' ', collections.map((c) => c.id).sort().join(', '));

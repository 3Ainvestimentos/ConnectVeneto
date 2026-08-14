/**
 * Somente leitura: baixa um arquivo já publicado na Biblioteca Comercial e roda a
 * mesma extração de texto que o navegador faz, para conferir o que o assistente
 * enxerga do conteúdo.
 *
 * Usage:
 *   node --env-file=.env.local scripts/try-document-extraction.mjs            # primeiro documento
 *   node --env-file=.env.local scripts/try-document-extraction.mjs <docId>
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import JSZip from 'jszip';

const MAX_EXTRACTED_CHARS = 8000;
const MAX_PPTX_SLIDES = 25;

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
const docId = process.argv[2];

const snapshot = docId
  ? await db.collection('commercialDocuments').doc(docId).get()
  : (await db.collection('commercialDocuments').limit(1).get()).docs[0];

if (!snapshot?.exists) {
  console.error('Documento não encontrado.');
  process.exit(1);
}

const data = snapshot.data();
console.log('documento:', data.title);
console.log('storagePath:', data.storagePath);

if (!data.storagePath) {
  console.error('Documento sem arquivo no Storage (é link).');
  process.exit(1);
}

const [buffer] = await getStorage()
  .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
  .file(data.storagePath)
  .download();

console.log('bytes baixados:', buffer.length);

// Mesma lógica de src/lib/document-text-extraction.ts (extractPptx).
const zip = await JSZip.loadAsync(buffer);
const slidePaths = Object.keys(zip.files)
  .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
  .sort((a, b) => {
    const numberOf = (path) => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
    return numberOf(a) - numberOf(b);
  });

console.log('slides encontrados:', slidePaths.length);

const slides = [];
for (const path of slidePaths.slice(0, MAX_PPTX_SLIDES)) {
  const xml = await zip.files[path].async('string');
  const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
  if (texts.length > 0) slides.push(`Slide ${slides.length + 1}: ${texts.join(' ')}`);
  if (slides.join(' ').length > MAX_EXTRACTED_CHARS) break;
}

const text = slides.join('\n').replace(/\s+/g, ' ').trim();

console.log('\n=== texto extraído ===');
console.log(text.slice(0, 2500) || '(vazio)');
console.log('\ncaracteres extraídos:', text.length);

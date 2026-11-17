/**
 * Copia a foto da conta Google (Firebase Auth) para `collaborators.photoURL` de quem está sem foto,
 * para os avatares do Hub mostrarem a foto. Daqui para frente o app faz isso sozinho no login
 * (`POST /api/me/photo`); este script cobre quem já tinha conta.
 *
 * Só preenche foto vazia ou troca outra foto do Google; foto posta à mão fica como está.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-collaborator-photos.mjs           # simulação
 *   node --env-file=.env.local scripts/backfill-collaborator-photos.mjs --apply   # grava
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);
const norm = (e) => (e ?? '').trim().toLowerCase();
const isGooglePhoto = (url) => typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//i.test(url);

const users = [];
let pageToken;
do {
  const page = await getAuth(app).listUsers(1000, pageToken);
  users.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);
const byUid = new Map(users.map((u) => [u.uid, u]));
const byEmail = new Map(users.map((u) => [norm(u.email), u]));

const snap = await db.collection('collaborators').get();
const changes = [];
for (const doc of snap.docs) {
  const c = doc.data();
  const account = (c.authUid && byUid.get(c.authUid)) || byEmail.get(norm(c.email));
  const photo = account?.photoURL;
  if (!isGooglePhoto(photo) || c.photoURL === photo) continue;
  const blank = typeof c.photoURL !== 'string' || !c.photoURL.trim() || c.photoURL.trim() === '—';
  if (!blank && !isGooglePhoto(c.photoURL)) continue;
  changes.push({ ref: doc.ref, name: c.name, photo });
}

console.log(`${APPLY ? 'GRAVANDO' : 'SIMULAÇÃO'}: ${changes.length} de ${snap.size} cadastros recebem a foto do Google.`);
for (const ch of changes) console.log(`  ${ch.name}`);

if (APPLY) {
  for (let i = 0; i < changes.length; i += 400) {
    const batch = db.batch();
    for (const ch of changes.slice(i, i + 400)) batch.update(ch.ref, { photoURL: ch.photo });
    await batch.commit();
  }
  console.log('Pronto.');
} else {
  console.log('Nada gravado. Rode com --apply para gravar.');
}

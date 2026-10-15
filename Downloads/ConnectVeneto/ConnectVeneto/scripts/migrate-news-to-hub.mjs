/**
 * Copia as Notícias publicadas (`newsItems`, status 'published') para o feed do Hub de
 * Comunicação (`hubPosts`), no canal Institucional. Idempotente: o id do destino é
 * `news-<id da notícia>`, então rodar de novo ATUALIZA o conteúdo e preserva reações,
 * comentários, presença e contadores já registrados no feed.
 *
 * `newsItems` NÃO é alterado (fica editável até a Fase 3 do plano). Notícia que deixou de estar
 * publicada é arquivada no feed.
 *
 * Mapeamento: título → título; snippet (ou conteúdo sem marcação) → texto; imagem → imagem;
 * vídeo → vídeo; link → botão "Saiba mais"; destaque → Importante por 14 dias a partir da data.
 * Autor: "Comunicação Vêneto" (newsItems não guarda autor).
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-news-to-hub.mjs
 *   node --env-file=.env.local scripts/migrate-news-to-hub.mjs --apply
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const DAY = 24 * 60 * 60 * 1000;
const HIGHLIGHT_DAYS = 14;
const AUTHOR = { email: 'comunicacao@venetomfo.com.br', name: 'Comunicação Vêneto', position: 'RH e Comunicação' };

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

const plain = (t = '') => t.replace(/<[^>]+>/g, ' ').replace(/[#*_>`]+/g, '').replace(/\s+/g, ' ').trim();
const isHttps = (u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u);
const videoOf = (url) => {
  if (!isHttps(url)) return undefined;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return { kind: 'youtube', url: `https://www.youtube.com/embed/${yt[1]}` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (drive) return { kind: 'drive', url: `https://drive.google.com/file/d/${drive[1]}/preview` };
  return { kind: url.includes('firebasestorage.googleapis.com') ? 'upload' : 'link', url };
};
const strip = (o) => JSON.parse(JSON.stringify(o));

const news = (await db.collection('newsItems').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — ${news.length} notícias em newsItems`);

let created = 0, updated = 0, archived = 0;
const now = new Date().toISOString();
const writes = [];

for (const n of news) {
  const id = `news-${n.id}`;
  const ref = db.collection('hubPosts').doc(id);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;

  if (n.status !== 'published') {
    if (prev && prev.status !== 'archived') {
      writes.push([ref, { status: 'archived', updatedAt: now }, true]);
      archived += 1;
      console.log(`  - arquiva ${id} (notícia agora '${n.status}')`);
    }
    continue;
  }

  const date = Number.isNaN(Date.parse(n.date)) ? now : new Date(n.date).toISOString();
  const content = {
    id,
    channelId: 'institucional',
    authorEmail: AUTHOR.email,
    authorName: AUTHOR.name,
    authorPosition: AUTHOR.position,
    title: String(n.title ?? '').slice(0, 200),
    body: (n.snippet?.trim() || plain(n.content).slice(0, 600) || n.title || '').slice(0, 10000),
    importance: n.isHighlight ? 'importante' : 'normal',
    highlightUntil: n.isHighlight ? new Date(Date.parse(date) + HIGHLIGHT_DAYS * DAY).toISOString() : null,
    images: isHttps(n.imageUrl) ? [{ url: n.imageUrl, ...(n.imageStoragePath ? { storagePath: n.imageStoragePath } : {}) }] : [],
    video: videoOf(n.videoUrl) ?? null,
    files: [],
    buttons: isHttps(n.link) ? [{ label: 'Saiba mais', href: n.link }] : [],
    status: 'published',
    source: 'news',
    legacyNewsId: n.id,
    createdAt: date,
    updatedAt: now,
  };

  if (prev) {
    // Preserva interações e contadores do feed; atualiza só o conteúdo vindo da notícia.
    writes.push([ref, strip(content), true]);
    updated += 1;
    console.log(`  ~ atualiza ${id} — ${content.title}`);
  } else {
    writes.push([
      ref,
      strip({ ...content, commentCount: 0, relevantCommentCount: 0, reactionCounts: {}, rsvpCounts: { vou: 0, talvez: 0, nao: 0 }, pollCounts: [] }),
      false,
    ]);
    created += 1;
    console.log(`  + cria ${id} — ${content.title}${n.isHighlight ? ' (Importante)' : ''}`);
  }
}

console.log(`\nResumo: ${created} novas, ${updated} atualizadas, ${archived} arquivadas.`);
if (!APPLY) {
  console.log('Nada gravado (dry-run). Rode com --apply para gravar.');
  process.exit(0);
}
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const [ref, data, merge] of writes.slice(i, i + 400)) batch.set(ref, data, { merge });
  await batch.commit();
}
console.log('OK: gravado em hubPosts.');

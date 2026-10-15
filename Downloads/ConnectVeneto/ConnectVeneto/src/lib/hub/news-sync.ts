/**
 * Espelho Notícias → feed durante o piloto (Fase 1 do plano): cada gravação em /api/admin/news
 * atualiza a publicação `news-<id>` em `hubPosts`, com o mesmo mapeamento de
 * `scripts/migrate-news-to-hub.mjs`. Interações do feed (reações, comentários, contadores) são
 * preservadas. Sai na Fase 2, quando o RH publicar só pelo feed.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { logSecurityEvent } from '@/lib/security';
import { parseVideoUrl } from './media';
import { HUB_COLLECTIONS, INSTITUTIONAL_CHANNEL_ID } from './model';

const DAY = 24 * 60 * 60 * 1000;
const HIGHLIGHT_DAYS = 14;
const AUTHOR = { email: 'comunicacao@venetomfo.com.br', name: 'Comunicação Vêneto', position: 'RH e Comunicação' };

const plain = (t = '') => t.replace(/<[^>]+>/g, ' ').replace(/[#*_>`]+/g, '').replace(/\s+/g, ' ').trim();
const isHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/\S+$/.test(u);

/** Best-effort: falha no espelho não pode derrubar a gravação da notícia (o script reconcilia). */
export async function syncNewsItemToHub(newsId: string): Promise<void> {
  try {
    const db = getFirestore(getFirebaseAdminApp());
    const newsSnap = await db.collection('newsItems').doc(newsId).get();
    const ref = db.collection(HUB_COLLECTIONS.posts).doc(`news-${newsId}`);
    const prev = await ref.get();
    const now = new Date().toISOString();

    if (!newsSnap.exists || newsSnap.data()?.status !== 'published') {
      if (prev.exists) await ref.set({ status: 'archived', updatedAt: now }, { merge: true });
      return;
    }

    const n = newsSnap.data()!;
    const date = Number.isNaN(Date.parse(n.date)) ? now : new Date(n.date).toISOString();
    const video = isHttps(n.videoUrl)
      ? n.videoUrl.includes('firebasestorage.googleapis.com')
        ? { kind: 'upload', url: n.videoUrl }
        : parseVideoUrl(n.videoUrl)
      : null;
    const content = {
      id: ref.id,
      channelId: INSTITUTIONAL_CHANNEL_ID,
      authorEmail: AUTHOR.email,
      authorName: AUTHOR.name,
      authorPosition: AUTHOR.position,
      title: String(n.title ?? '').slice(0, 200),
      body: (String(n.snippet ?? '').trim() || plain(n.content).slice(0, 600) || n.title || '').slice(0, 10000),
      importance: n.isHighlight ? 'importante' : 'normal',
      highlightUntil: n.isHighlight ? new Date(Date.parse(date) + HIGHLIGHT_DAYS * DAY).toISOString() : null,
      images: isHttps(n.imageUrl) ? [{ url: n.imageUrl, ...(n.imageStoragePath ? { storagePath: n.imageStoragePath } : {}) }] : [],
      video,
      files: [],
      buttons: isHttps(n.link) ? [{ label: 'Saiba mais', href: n.link }] : [],
      status: 'published',
      source: 'news',
      legacyNewsId: newsId,
      createdAt: date,
      updatedAt: now,
    };

    if (prev.exists) {
      await ref.set(content, { merge: true });
    } else {
      await ref.set({ ...content, commentCount: 0, relevantCommentCount: 0, reactionCounts: {}, rsvpCounts: { vou: 0, talvez: 0, nao: 0 }, pollCounts: [] });
    }
  } catch (error) {
    logSecurityEvent('[hub/news-sync] falha ao espelhar notícia', { newsId, error: error instanceof Error ? error.message : 'unknown' });
  }
}

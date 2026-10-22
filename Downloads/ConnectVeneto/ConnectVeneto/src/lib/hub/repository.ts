/**
 * Repositório do Hub de Comunicação — ÚNICO lugar que conhece o armazenamento (hoje Firestore via
 * Admin SDK). Rotas e telas falam só com estas funções; na migração para o Azure SQL, troca-se a
 * implementação daqui e o resto do app não muda.
 *
 * Consultas evitam índice composto (a service account não cria índices): filtro de igualdade
 * simples no servidor + ordenação/filtragem em memória, com limites.
 */
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  HUB_COLLECTIONS as C,
  normalizePostInput,
  pairId,
  type CreatePostInput,
  type DigestResponse,
  type FeedChannel,
  type FeedComment,
  type FeedPost,
  type HubChannel,
  type HubChannelFollow,
  type HubComment,
  type HubDigestState,
  type HubPost,
  type RsvpAnswer,
} from './model';
import { canPublishIn, type HubViewer } from './access';
import { notifyCommentHighlighted, notifyMentions, notifyNewComment } from './notify';

const FEED_LIMIT = 150;
const nowIso = () => new Date().toISOString();
const db = (): Firestore => getFirestore(getFirebaseAdminApp());
const emptyRsvp = (): Record<RsvpAnswer, number> => ({ vou: 0, talvez: 0, nao: 0 });

function notFound(): never {
  throw new Error('HUB_NOT_FOUND');
}

async function getPostTx(tx: Transaction, postId: string): Promise<HubPost> {
  const snap = await tx.get(db().collection(C.posts).doc(postId));
  if (!snap.exists) notFound();
  return snap.data() as HubPost;
}

// ---------- Canais ----------

export async function listChannels(): Promise<HubChannel[]> {
  const snap = await db().collection(C.channels).get();
  return snap.docs
    .map((d) => d.data() as HubChannel)
    .filter((c) => c.active)
    .sort((a, b) => a.order - b.order);
}

export async function getChannel(id: string): Promise<HubChannel | null> {
  const snap = await db().collection(C.channels).doc(id).get();
  return snap.exists ? (snap.data() as HubChannel) : null;
}

async function followsOf(email: string): Promise<Map<string, HubChannelFollow>> {
  const snap = await db().collection(C.follows).where('email', '==', email).get();
  return new Map(snap.docs.map((d) => [(d.data() as HubChannelFollow).channelId, d.data() as HubChannelFollow]));
}

export async function listChannelsFor(viewer: HubViewer): Promise<FeedChannel[]> {
  const [channels, follows] = await Promise.all([listChannels(), followsOf(viewer.email)]);
  return channels.map((c) => {
    const f = follows.get(c.id);
    return {
      id: c.id,
      name: c.name,
      following: f ? f.following : c.seeded,
      notify: f?.notify ?? 'feed',
      canPublish: canPublishIn(viewer, c),
    };
  });
}

export async function setFollow(email: string, channelId: string, following: boolean, notify?: 'feed' | 'bell') {
  const id = pairId(email, channelId);
  const doc: HubChannelFollow = { id, email, channelId, following, notify: notify ?? 'feed', updatedAt: nowIso() };
  await db().collection(C.follows).doc(id).set(doc, { merge: true });
}

// ---------- Feed ----------

/** Publicações vivas (publicadas e não vencidas), com o que a pessoa já fez em cada uma. */
export async function listFeed(viewer: HubViewer): Promise<FeedPost[]> {
  const snap = await db().collection(C.posts).orderBy('createdAt', 'desc').limit(FEED_LIMIT).get();
  const now = Date.now();
  const posts = snap.docs
    .map((d) => d.data() as HubPost)
    .filter((p) => p.status === 'published' && (!p.expiresAt || Date.parse(p.expiresAt) >= now));

  const ids = new Set(posts.map((p) => p.id));
  const [reactions, rsvps, votes] = await Promise.all(
    [C.reactions, C.rsvps, C.pollVotes].map((col) => db().collection(col).where('email', '==', viewer.email).get()),
  );
  const byPost = <T,>(s: FirebaseFirestore.QuerySnapshot, pick: (d: FirebaseFirestore.DocumentData) => T) =>
    new Map(s.docs.filter((d) => ids.has(d.data().postId)).map((d) => [d.data().postId as string, pick(d.data())]));
  const myReaction = byPost(reactions, (d) => d.emoji as string);
  const myRsvp = byPost(rsvps, (d) => d.answer as RsvpAnswer);
  const myVote = byPost(votes, (d) => d.optionIndex as number);

  return posts.map(({ legacyNewsId: _legacy, ...p }) => ({
    ...p,
    myReaction: myReaction.get(p.id) ?? null,
    myRsvp: myRsvp.get(p.id) ?? null,
    myVote: myVote.get(p.id) ?? null,
    canManage: viewer.isContentManager || p.authorEmail === viewer.email,
  }));
}

// ---------- Publicações ----------

export async function createPost(viewer: HubViewer, raw: CreatePostInput): Promise<HubPost> {
  const normalized = normalizePostInput(raw);
  if (!normalized.ok) throw new Error(`INVALID_POST:${normalized.error}`);
  const input = normalized.value;
  const channel = await getChannel(input.channelId);
  if (!channel || !canPublishIn(viewer, channel)) throw new Error('FORBIDDEN_HUB_PUBLISHER');

  const ref = db().collection(C.posts).doc();
  const ts = nowIso();
  const post: HubPost = {
    id: ref.id,
    channelId: channel.id,
    authorEmail: viewer.email,
    authorName: viewer.name,
    ...(viewer.position ? { authorPosition: viewer.position } : {}),
    title: input.title,
    body: input.body,
    kind: input.kind,
    importance: input.importance,
    ...(input.importance === 'importante' && input.highlightUntil ? { highlightUntil: input.highlightUntil } : {}),
    // Evento sai do feed no dia seguinte ao término.
    ...(input.event ? { expiresAt: new Date(Date.parse(input.event.end ?? input.event.start) + 24 * 3600 * 1000).toISOString() } : {}),
    images: input.images,
    ...(input.video ? { video: input.video } : {}),
    files: input.files,
    buttons: input.buttons,
    ...(input.event ? { event: input.event } : {}),
    ...(input.poll ? { poll: input.poll } : {}),
    status: 'published',
    source: 'hub',
    createdAt: ts,
    updatedAt: ts,
    commentCount: 0,
    relevantCommentCount: 0,
    reactionCounts: {},
    rsvpCounts: emptyRsvp(),
    pollCounts: input.poll ? input.poll.options.map(() => 0) : [],
  };
  await ref.set(stripUndefined(post));
  await notifyMentions(post);
  return post;
}

export async function updatePost(
  viewer: HubViewer,
  postId: string,
  patch: Partial<Pick<HubPost, 'status' | 'importance' | 'title' | 'body'>> & { highlightUntil?: string | null },
): Promise<void> {
  const ref = db().collection(C.posts).doc(postId);
  await db().runTransaction(async (tx) => {
    const post = await getPostTx(tx, postId);
    if (!(viewer.isContentManager || post.authorEmail === viewer.email)) throw new Error('FORBIDDEN_HUB_POST_OWNER');
    const { highlightUntil, ...rest } = patch;
    const update: Record<string, unknown> = { ...rest, updatedAt: nowIso() };
    if (highlightUntil !== undefined) update.highlightUntil = highlightUntil ?? null;
    tx.update(ref, update);
  });
}

// ---------- Comentários ----------

/** Leitores veem só os relevantes e os próprios; o autor (e a Comunicação) vê todos. */
export async function listComments(viewer: HubViewer, postId: string): Promise<FeedComment[]> {
  const postSnap = await db().collection(C.posts).doc(postId).get();
  if (!postSnap.exists) notFound();
  const post = postSnap.data() as HubPost;
  const seesAll = viewer.isContentManager || post.authorEmail === viewer.email;

  const snap = await db().collection(C.comments).where('postId', '==', postId).get();
  return snap.docs
    .map((d) => d.data() as HubComment)
    .filter((c) => seesAll || c.relevant || c.authorEmail === viewer.email)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, authorEmail, authorName, text, relevant, createdAt }) => ({ id, authorEmail, authorName, text, relevant, createdAt }));
}

export async function addComment(viewer: HubViewer, postId: string, text: string): Promise<HubComment> {
  const postRef = db().collection(C.posts).doc(postId);
  const ref = db().collection(C.comments).doc();
  const comment: HubComment = { id: ref.id, postId, authorEmail: viewer.email, authorName: viewer.name, text, relevant: false, createdAt: nowIso() };
  const post = await db().runTransaction(async (tx) => {
    const p = await getPostTx(tx, postId);
    tx.set(ref, comment);
    tx.update(postRef, { commentCount: (p.commentCount ?? 0) + 1 });
    return p;
  });
  await notifyNewComment(post, comment);
  return comment;
}

export async function setCommentRelevant(viewer: HubViewer, postId: string, commentId: string, relevant: boolean): Promise<HubComment> {
  const postRef = db().collection(C.posts).doc(postId);
  const ref = db().collection(C.comments).doc(commentId);
  let notify: { post: HubPost; comment: HubComment } | null = null;
  const result = await db().runTransaction(async (tx) => {
    const post = await getPostTx(tx, postId);
    if (!(viewer.isContentManager || post.authorEmail === viewer.email)) throw new Error('FORBIDDEN_HUB_POST_OWNER');
    const snap = await tx.get(ref);
    if (!snap.exists) notFound();
    const comment = snap.data() as HubComment;
    if (comment.postId !== postId) notFound();
    if (comment.relevant !== relevant) {
      tx.update(ref, { relevant, relevantMarkedAt: relevant ? nowIso() : null });
      tx.update(postRef, { relevantCommentCount: Math.max(0, (post.relevantCommentCount ?? 0) + (relevant ? 1 : -1)) });
      if (relevant) notify = { post, comment };
    }
    return { ...comment, relevant };
  });
  const pending = notify as { post: HubPost; comment: HubComment } | null;
  if (pending) await notifyCommentHighlighted(pending.post, pending.comment);
  return result;
}

// ---------- Reação, presença, voto ----------

export async function setReaction(viewer: HubViewer, postId: string, emoji: string | null): Promise<void> {
  const postRef = db().collection(C.posts).doc(postId);
  const ref = db().collection(C.reactions).doc(pairId(postId, viewer.email));
  await db().runTransaction(async (tx) => {
    const post = await getPostTx(tx, postId);
    const prev = await tx.get(ref);
    const counts = { ...(post.reactionCounts ?? {}) };
    const before = prev.exists ? (prev.data()!.emoji as string) : null;
    if (before === emoji) return;
    if (before) counts[before] = Math.max(0, (counts[before] ?? 1) - 1);
    if (emoji) {
      counts[emoji] = (counts[emoji] ?? 0) + 1;
      tx.set(ref, { id: ref.id, postId, email: viewer.email, emoji, createdAt: nowIso() });
    } else {
      tx.delete(ref);
    }
    tx.update(postRef, { reactionCounts: counts });
  });
}

export async function setRsvp(viewer: HubViewer, postId: string, answer: RsvpAnswer | null): Promise<void> {
  const postRef = db().collection(C.posts).doc(postId);
  const ref = db().collection(C.rsvps).doc(pairId(postId, viewer.email));
  await db().runTransaction(async (tx) => {
    const post = await getPostTx(tx, postId);
    if (!post.event) notFound();
    const prev = await tx.get(ref);
    const before = prev.exists ? (prev.data()!.answer as RsvpAnswer) : null;
    if (before === answer) return;
    const counts = { ...emptyRsvp(), ...(post.rsvpCounts ?? {}) };
    if (before) counts[before] = Math.max(0, counts[before] - 1);
    if (answer) {
      counts[answer] += 1;
      tx.set(ref, { id: ref.id, postId, email: viewer.email, answer, updatedAt: nowIso() });
    } else {
      tx.delete(ref);
    }
    tx.update(postRef, { rsvpCounts: counts });
  });
}

/** Voto é definitivo (como no wireframe): segundo voto é ignorado. */
export async function vote(viewer: HubViewer, postId: string, optionIndex: number): Promise<void> {
  const postRef = db().collection(C.posts).doc(postId);
  const ref = db().collection(C.pollVotes).doc(pairId(postId, viewer.email));
  await db().runTransaction(async (tx) => {
    const post = await getPostTx(tx, postId);
    if (!post.poll || optionIndex >= post.poll.options.length) notFound();
    if ((await tx.get(ref)).exists) return;
    const counts = post.poll.options.map((_, i) => post.pollCounts?.[i] ?? 0);
    counts[optionIndex] += 1;
    tx.set(ref, { id: ref.id, postId, email: viewer.email, optionIndex, createdAt: nowIso() });
    tx.update(postRef, { pollCounts: counts });
  });
}

// ---------- Resumo diário ----------

/** Sem histórico (primeira vez), o resumo cobre as últimas 72 horas. */
const DIGEST_DEFAULT_HOURS = 72;
const DIGEST_LIMIT = 30;

export async function getDigestLastSeen(email: string): Promise<string | null> {
  const snap = await db().collection(C.digestState).doc(email).get();
  return snap.exists ? ((snap.data() as HubDigestState).lastSeenAt ?? null) : null;
}

export async function markDigestSeen(email: string): Promise<string> {
  const at = nowIso();
  const doc: HubDigestState = { email, lastSeenAt: at, updatedAt: at };
  await db().collection(C.digestState).doc(email).set(doc);
  return at;
}

/**
 * Publicações Normais dos canais seguidos criadas depois de `since` (padrão: o último resumo
 * visto ou, sem histórico, as últimas 72h). Agrupadas por canal, na ordem dos canais.
 */
export async function listDigest(viewer: HubViewer, sinceOverride?: string): Promise<DigestResponse> {
  const since =
    sinceOverride ?? (await getDigestLastSeen(viewer.email)) ?? new Date(Date.now() - DIGEST_DEFAULT_HOURS * 3600 * 1000).toISOString();
  const [channels, snap] = await Promise.all([
    listChannelsFor(viewer),
    db().collection(C.posts).where('createdAt', '>', since).orderBy('createdAt', 'desc').limit(FEED_LIMIT).get(),
  ]);
  const followed = channels.filter((c) => c.following);
  const followedIds = new Set(followed.map((c) => c.id));
  const now = Date.now();
  const posts = snap.docs
    .map((d) => d.data() as HubPost)
    .filter(
      (p) =>
        p.status === 'published' &&
        p.importance === 'normal' &&
        followedIds.has(p.channelId) &&
        p.authorEmail !== viewer.email &&
        (!p.expiresAt || Date.parse(p.expiresAt) >= now),
    )
    .slice(0, DIGEST_LIMIT);

  const excerpt = (text: string) => {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > 160 ? `${flat.slice(0, 157).trimEnd()}…` : flat;
  };

  return {
    since,
    channels: followed
      .map((c) => ({
        id: c.id,
        name: c.name,
        posts: posts
          .filter((p) => p.channelId === c.id)
          .map((p) => ({
            id: p.id,
            title: p.title,
            excerpt: excerpt(p.body),
            authorName: p.authorName,
            createdAt: p.createdAt,
            channelName: c.name,
            ...(p.images?.[0]?.url ? { imageUrl: p.images[0].url } : {}),
            hasEvent: !!p.event,
            hasPoll: !!p.poll,
            hasVideo: !!p.video,
          })),
      }))
      .filter((c) => c.posts.length > 0),
  };
}

// ---------- Utilidades ----------

/** Firestore não aceita `undefined`; remove chaves vazias antes de gravar. */
export function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}


/**
 * Avisos do Hub de Comunicação pela Central de Notificações (sino). Best-effort: falhar ao
 * notificar nunca desfaz a ação de quem publicou ou comentou.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { normalizeEmail } from '@/lib/email-utils';
import { logSecurityEvent } from '@/lib/security';
import { createNotifications } from '@/lib/notifications/server';
import type { HubComment, HubPost } from './model';

const SOURCE = 'hub-feed';
const postLink = (postId: string) => ({ path: `/publicacoes?p=${postId}` });
const firstName = (name: string) => name.split(' ')[0];

async function send(input: Parameters<typeof createNotifications>[0]) {
  try {
    await createNotifications(input);
  } catch (error) {
    logSecurityEvent('[hub/notify] falha ao notificar', { error: error instanceof Error ? error.message : 'unknown' });
  }
}

/** Comentário novo: avisa o autor da publicação (é ele quem decide o que fica visível). */
export function notifyNewComment(post: HubPost, comment: HubComment) {
  if (post.authorEmail === comment.authorEmail || post.source === 'news') return Promise.resolve();
  return send({
    source: SOURCE,
    recipients: [post.authorEmail],
    title: `${firstName(comment.authorName)} comentou na sua publicação`,
    body: `"${post.title}": marque como relevante se o comentário deve aparecer para todos.`,
    link: postLink(post.id),
    externalRef: `comment:${comment.id}`,
    readPolicy: 'on_open',
  });
}

/** Comentário marcado como relevante: avisa quem comentou. */
export function notifyCommentHighlighted(post: HubPost, comment: HubComment) {
  if (post.authorEmail === comment.authorEmail) return Promise.resolve();
  return send({
    source: SOURCE,
    recipients: [comment.authorEmail],
    title: 'Seu comentário agora aparece para todos',
    body: `${firstName(post.authorName)} destacou seu comentário em "${post.title}".`,
    link: postLink(post.id),
    externalRef: `relevant:${comment.id}`,
    readPolicy: 'on_open',
  });
}

/**
 * Menções "@Nome Sobrenome" no texto: resolve pelo nome do colaborador (primeiro + último nome,
 * sem acento e sem diferença de caixa) e avisa as pessoas encontradas.
 */
export async function notifyMentions(post: HubPost) {
  const mentions = [...post.body.matchAll(/@(\p{Lu}\p{L}+ \p{Lu}\p{L}+)/gu)].map((m) => m[1]);
  if (mentions.length === 0) return;
  const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const wanted = new Set(mentions.map(key));

  const snap = await getFirestore(getFirebaseAdminApp()).collection('collaborators').select('name', 'email').get();
  const recipients = snap.docs
    .map((d) => d.data() as { name?: string; email?: string })
    .filter((c) => {
      const parts = (c.name ?? '').trim().split(/\s+/);
      return parts.length >= 2 && wanted.has(key(`${parts[0]} ${parts[parts.length - 1]}`));
    })
    .map((c) => normalizeEmail(c.email))
    .filter((e): e is string => !!e && e !== post.authorEmail);

  if (recipients.length === 0) return;
  await send({
    source: SOURCE,
    recipients,
    title: `${firstName(post.authorName)} mencionou você`,
    body: post.title,
    link: postLink(post.id),
    externalRef: `mention:${post.id}`,
    readPolicy: 'on_open',
  });
}

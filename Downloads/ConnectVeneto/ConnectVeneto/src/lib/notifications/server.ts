/**
 * Emissão e resolução de notificações (Admin SDK). Usado pelas rotas
 * /api/hub/notifications* e disponível para features do próprio hub.
 */
import { createHash } from 'crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { normalizeEmail } from '@/lib/email-utils';
import {
  NOTIFICATIONS_COLLECTION,
  type NotificationLink,
  type NotificationReadPolicy,
} from './types';

const CORPORATE_DOMAIN = '@venetomfo.com.br';
const BATCH_LIMIT = 400;

export type CreateNotificationsInput = {
  source: string;
  recipients: string[];
  title: string;
  body?: string | null;
  link?: NotificationLink | null;
  externalRef?: string | null;
  readPolicy?: NotificationReadPolicy;
};

/** Normaliza, deduplica e descarta e-mails fora do domínio corporativo. */
export function normalizeRecipients(recipients: string[]): string[] {
  const out = new Set<string>();
  for (const r of recipients) {
    const email = normalizeEmail(r);
    if (email && email.endsWith(CORPORATE_DOMAIN)) out.add(email);
  }
  return [...out];
}

/**
 * ID determinístico quando há externalRef: reenviar a mesma notificação
 * (retry, reabertura) sobrescreve o documento em vez de duplicar.
 */
export function notificationDocId(source: string, externalRef: string, email: string): string {
  const hash = createHash('sha256').update(`${source}|${externalRef}|${email}`).digest('hex');
  return `${source}_${hash.slice(0, 32)}`;
}

function db() {
  return getFirestore(getFirebaseAdminApp());
}

/** Cria (ou reabre, se já existir com o mesmo externalRef) uma notificação por destinatário. */
export async function createNotifications(input: CreateNotificationsInput): Promise<number> {
  const recipients = normalizeRecipients(input.recipients);
  if (recipients.length === 0) return 0;

  const col = db().collection(NOTIFICATIONS_COLLECTION);
  const now = FieldValue.serverTimestamp();

  for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const email of recipients.slice(i, i + BATCH_LIMIT)) {
      const ref = input.externalRef
        ? col.doc(notificationDocId(input.source, input.externalRef, email))
        : col.doc();
      batch.set(ref, {
        recipientEmail: email,
        source: input.source,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        externalRef: input.externalRef ?? null,
        readPolicy: input.readPolicy ?? 'on_open',
        read: false,
        readAt: null,
        resolvedAt: null,
        createdAt: now,
      });
    }
    await batch.commit();
  }
  return recipients.length;
}

/**
 * Marca como lidas (resolvidas) as notificações de um externalRef.
 * Sem `recipients`, resolve para todos os destinatários. Idempotente.
 */
export async function resolveNotifications(
  source: string,
  externalRef: string,
  recipients?: string[],
): Promise<number> {
  const col = db().collection(NOTIFICATIONS_COLLECTION);
  const snap = await col
    .where('source', '==', source)
    .where('externalRef', '==', externalRef)
    .get();

  const only = recipients ? new Set(normalizeRecipients(recipients)) : null;
  const targets = snap.docs.filter(
    (d) => d.get('read') !== true && (!only || only.has(d.get('recipientEmail'))),
  );
  if (targets.length === 0) return 0;

  const now = FieldValue.serverTimestamp();
  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const d of targets.slice(i, i + BATCH_LIMIT)) {
      batch.update(d.ref, { read: true, readAt: now, resolvedAt: now });
    }
    await batch.commit();
  }
  return targets.length;
}

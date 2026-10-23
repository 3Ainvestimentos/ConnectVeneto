import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  FEEDBACK_COLLECTION,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_STATUS,
  FEEDBACK_TYPES,
  type FeedbackItem,
  type FeedbackListResponse,
  type FeedbackStatus,
  type FeedbackType,
} from '@/lib/feedback';
import { isSuperAdminAddress, logSecurityEvent, requireCorporateUser, requireSuperAdmin, securityErrorResponse } from '@/lib/security';

export const dynamic = 'force-dynamic';

const createSchema = z
  .object({
    type: z.enum(FEEDBACK_TYPES),
    description: z.string().trim().min(1, 'Escreva o que aconteceu.').max(FEEDBACK_MAX_LENGTH),
    page: z.string().trim().max(200).nullable().optional(),
  })
  .strict();
const updateSchema = z
  .object({
    id: z.string().trim().min(1),
    status: z.enum(FEEDBACK_STATUS).optional(),
    response: z.string().trim().max(FEEDBACK_MAX_LENGTH).nullable().optional(),
  })
  .strict();

const db = () => getFirestore(getFirebaseAdminApp());
const ok = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Limite simples por pessoa (memória da instância): 20 envios por minuto. */
const recent = new Map<string, number[]>();
function allow(email: string): boolean {
  const now = Date.now();
  const list = (recent.get(email) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 20) return false;
  recent.set(email, [...list, now]);
  return true;
}

function toItem(id: string, v: FirebaseFirestore.DocumentData, withAuthor: boolean): FeedbackItem {
  return {
    id,
    type: (FEEDBACK_TYPES as readonly string[]).includes(v.type) ? (v.type as FeedbackType) : 'erro',
    description: String(v.description ?? ''),
    page: v.page ? String(v.page) : null,
    status: (FEEDBACK_STATUS as readonly string[]).includes(v.status) ? (v.status as FeedbackStatus) : 'aberto',
    response: v.response ? String(v.response) : null,
    createdAt: String(v.createdAt ?? ''),
    updatedAt: v.updatedAt ? String(v.updatedAt) : null,
    ...(withAuthor ? { authorEmail: String(v.authorEmail ?? ''), authorName: String(v.authorName ?? '') } : {}),
  };
}

function handle(error: unknown, action: string) {
  const known = securityErrorResponse(error);
  if (known) return known;
  logSecurityEvent(`[api/feedback] falha (${action})`, { error: error instanceof Error ? error.message : 'unknown' });
  return bad('Não foi possível concluir. Tente de novo.', 500);
}

/** As solicitações da pessoa; super admin recebe todas, com o autor. */
export async function GET(request: Request) {
  try {
    const auth = await requireCorporateUser(request.headers.get('Authorization'));
    if (!auth.email) return bad('Sessão sem e-mail.', 401);
    const all = await isSuperAdminAddress(auth.email);
    const col = db().collection(FEEDBACK_COLLECTION);
    // Sem orderBy na consulta filtrada: evita índice composto; ordena aqui.
    const snap = all ? await col.orderBy('createdAt', 'desc').limit(300).get() : await col.where('authorEmail', '==', auth.email).limit(200).get();
    const items = snap.docs.map((d) => toItem(d.id, d.data(), all)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const body: FeedbackListResponse = { items, all };
    return ok(body);
  } catch (error) {
    return handle(error, 'GET');
  }
}

/** Qualquer pessoa logada reporta um erro ou manda uma sugestão. */
export async function POST(request: Request) {
  try {
    const auth = await requireCorporateUser(request.headers.get('Authorization'));
    if (!auth.email) return bad('Sessão sem e-mail.', 401);
    if (!allow(auth.email)) return bad('Muitos envios em pouco tempo — aguarde um minuto.', 429);
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const collab = await db().collection('collaborators').where('email', '==', auth.email).limit(1).get();
    const now = new Date().toISOString();
    const ref = await db()
      .collection(FEEDBACK_COLLECTION)
      .add({
        type: parsed.data.type,
        description: parsed.data.description,
        page: parsed.data.page ?? null,
        status: 'aberto',
        response: null,
        authorEmail: auth.email,
        authorName: collab.empty ? auth.email : String(collab.docs[0].get('name') ?? auth.email),
        createdAt: now,
        updatedAt: null,
      });
    return ok({ id: ref.id });
  } catch (error) {
    return handle(error, 'POST');
  }
}

/** Triagem (super admin): muda o status e/ou escreve a resposta. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin(request.headers.get('Authorization'));
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const { id, ...patch } = parsed.data;
    if (patch.status === undefined && patch.response === undefined) return bad('Nada para atualizar.');
    const ref = db().collection(FEEDBACK_COLLECTION).doc(id);
    if (!(await ref.get()).exists) return bad('Solicitação não encontrada.', 404);
    await ref.update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.response !== undefined ? { response: patch.response || null } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: auth.email,
    });
    return ok({ ok: true });
  } catch (error) {
    return handle(error, 'PATCH');
  }
}

import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { logSecurityEvent, requireCorporateUser, securityErrorResponse } from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

const COLLECTION_NAME = 'collaborators';

const list = z.array(z.string().trim().min(1).max(60)).max(15);

/**
 * Dados pessoais do Perfil, editados pela própria pessoa. Só estes campos passam (`.strict()`):
 * cargo, área, equipe, gestor, datas e permissões continuam com o RH e com o super admin.
 */
const personalSchema = z
  .object({
    bio: z.string().trim().max(500),
    responsibilities: list,
    interests: list,
    phone: z.string().trim().max(40),
    googleChat: z.string().trim().max(120),
  })
  .strict()
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nada para atualizar.');

async function findOwnDoc(uid: string, email: string | null) {
  const db = getFirestore(getFirebaseAdminApp());
  const byUid = await db.collection(COLLECTION_NAME).where('authUid', '==', uid).limit(1).get();
  if (!byUid.empty) return byUid.docs[0];
  if (!email) return null;
  const byEmail = await db.collection(COLLECTION_NAME).where('email', '==', email).limit(1).get();
  return byEmail.empty ? null : byEmail.docs[0];
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireCorporateUser(request.headers.get('Authorization'));
    const parsed = personalSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requisição inválida.' }, { status: 400 });
    }

    const doc = await findOwnDoc(auth.uid, auth.email);
    if (!doc) return NextResponse.json({ error: 'Seu cadastro de colaborador não foi encontrado.' }, { status: 404 });

    await doc.ref.update({ ...parsed.data, profileUpdatedAt: new Date().toISOString() });
    logSecurityEvent('[api/me/profile] perfil pessoal atualizado', { email: auth.email, fields: Object.keys(parsed.data).join(',') });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const known = securityErrorResponse(error);
    if (known) return known;
    logSecurityEvent('[api/me/profile] falha', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Não foi possível salvar o perfil.' }, { status: 500 });
  }
}

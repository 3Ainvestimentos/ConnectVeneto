import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logSecurityEvent, requireCorporateUser, securityErrorResponse } from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

const COLLECTION_NAME = 'collaborators';

/** Foto que veio do Google (pode ser trocada quando a pessoa muda a foto da conta). */
const isGooglePhoto = (url: unknown) => typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//i.test(url);

/**
 * Copia a foto da conta Google da pessoa (Firebase Auth) para o cadastro dela em `collaborators`,
 * para os avatares do Hub mostrarem a foto. A URL vem do Admin SDK, nunca do navegador. Não
 * sobrescreve foto posta à mão (só preenche vazio ou troca outra foto do Google).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCorporateUser(request.headers.get('Authorization'));
    const app = getFirebaseAdminApp();
    const photoURL = (await getAuth(app).getUser(auth.uid)).photoURL ?? '';
    if (!isGooglePhoto(photoURL)) return NextResponse.json({ updated: false });

    const db = getFirestore(app);
    const byUid = await db.collection(COLLECTION_NAME).where('authUid', '==', auth.uid).limit(1).get();
    const doc = !byUid.empty
      ? byUid.docs[0]
      : auth.email
        ? (await db.collection(COLLECTION_NAME).where('email', '==', auth.email).limit(1).get()).docs[0]
        : undefined;
    if (!doc) return NextResponse.json({ updated: false });

    const current = doc.get('photoURL');
    const blank = typeof current !== 'string' || !current.trim() || current.trim() === '—';
    if (current === photoURL || (!blank && !isGooglePhoto(current))) return NextResponse.json({ updated: false });

    await doc.ref.update({ photoURL });
    return NextResponse.json({ updated: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const known = securityErrorResponse(error);
    if (known) return known;
    logSecurityEvent('[api/me/photo] falha', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Não foi possível atualizar a foto.' }, { status: 500 });
  }
}

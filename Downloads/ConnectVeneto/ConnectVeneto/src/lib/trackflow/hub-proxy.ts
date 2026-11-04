/**
 * Proxy server-side para endpoints do TrackFlow autenticados pelo hub JWT
 * (`/api/summary`, `/api/hub/fluxos`). Assina um token de 60 s (issuer `connect-veneto`,
 * audience `trackflow`) e encaminha a requisição de servidor para servidor.
 * Ref: CONNECTVENETO_MODULE_PROTOCOL.md
 */
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { getHubJwtSecret } from '@/lib/hub-jwt';
import { getHubModuleServer } from '@/lib/hub-modules/server';
import { requireCorporateUser, type AuthenticatedRequestContext } from '@/lib/security';

const TOKEN_TTL_SECONDS = 60;

/** Nome do colaborador para o token; cai na parte local do e-mail se não achar. */
async function resolveDisplayName(context: AuthenticatedRequestContext): Promise<string> {
  const fallback = context.email?.split('@')[0] ?? '';
  try {
    const db = getFirestore(getFirebaseAdminApp());
    const snap = await db.collection('collaborators').where('authUid', '==', context.uid).limit(1).get();
    if (!snap.empty) return (snap.docs[0].data().name as string | undefined) ?? fallback;
    if (context.email) {
      const byEmail = await db.collection('collaborators').where('email', '==', context.email).limit(1).get();
      if (!byEmail.empty) return (byEmail.docs[0].data().name as string | undefined) ?? fallback;
    }
  } catch {
    // fallback silencioso
  }
  return fallback;
}

/** Hub JWT de 60 s para chamadas server-to-server ao TrackFlow. */
export async function signTrackflowHubToken(context: AuthenticatedRequestContext): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email:       context.email,
    name:        await resolveDisplayName(context),
    role:        'member',
    permissions: ['trackflow:view'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(context.uid)
    .setIssuer('connect-veneto')
    .setAudience('trackflow')
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(getHubJwtSecret());
}

type ProxyOptions = {
  /** Desiste do TrackFlow depois deste tempo e responde 504. Sem valor, espera o fetch. */
  timeoutMs?: number;
};

/**
 * GET autenticado no TrackFlow em nome de quem chamou. A URL do módulo vem do registro
 * `hubModules` (aba Módulos do /admin). Erros do TrackFlow voltam com o status dele;
 * TrackFlow fora do ar ou lento volta 504.
 */
export async function proxyTrackflowGet(
  request: Request,
  upstreamPath: string,
  { timeoutMs }: ProxyOptions = {},
) {
  try {
    const context = await requireCorporateUser(request.headers.get('Authorization'));

    const trackflow = await getHubModuleServer('trackflow');
    if (!trackflow || trackflow.kind !== 'embedded' || !trackflow.enabled) {
      return NextResponse.json({ error: 'TrackFlow indisponível' }, { status: 404 });
    }

    const token = await signTrackflowHubToken(context);
    const res = await fetch(`${trackflow.url.replace(/\/$/, '')}${upstreamPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    }).catch(() => null);

    if (!res) {
      return NextResponse.json({ error: 'TrackFlow indisponível' }, { status: 504 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'TrackFlow indisponível' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

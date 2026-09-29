/**
 * Proxy server-side para o endpoint /api/summary do TrackFlow.
 * Assina um hub JWT e encaminha a requisição de servidor para servidor.
 */
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getHubJwtSecret } from '@/lib/hub-jwt';
import { requireCorporateUser } from '@/lib/security';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { getHubModuleServer } from '@/lib/hub-modules/server';

export async function GET(request: Request) {
  try {
    const context = await requireCorporateUser(request.headers.get('Authorization'));

    // URL vem do registro `hubModules` (aba Módulos do /admin), não mais de env.
    const trackflow = await getHubModuleServer('trackflow');
    if (!trackflow || trackflow.kind !== 'embedded' || !trackflow.enabled) {
      return NextResponse.json({ error: 'TrackFlow indisponível' }, { status: 404 });
    }
    const TRACKFLOW_URL = trackflow.url;

    let displayName = context.email?.split('@')[0] ?? '';
    try {
      const db = getFirestore(getFirebaseAdminApp());
      const snap = await db.collection('collaborators').where('authUid', '==', context.uid).limit(1).get();
      if (!snap.empty) {
        displayName = (snap.docs[0].data().name as string | undefined) ?? displayName;
      } else if (context.email) {
        const byEmail = await db.collection('collaborators').where('email', '==', context.email).limit(1).get();
        if (!byEmail.empty) {
          displayName = (byEmail.docs[0].data().name as string | undefined) ?? displayName;
        }
      }
    } catch {
      // fallback silencioso
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      email:       context.email,
      name:        displayName,
      role:        'member',
      permissions: ['trackflow:view'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(context.uid)
      .setIssuer('connect-veneto')
      .setAudience('trackflow')
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(getHubJwtSecret());

    const res = await fetch(`${TRACKFLOW_URL}/api/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

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

/**
 * Proxy server-side para o endpoint /api/summary do TrackFlow.
 * Assina um hub JWT e encaminha a requisição de servidor para servidor.
 */
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { requireCorporateUser } from '@/lib/security';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

function getHubJwtSecret() {
  const raw = process.env.HUB_JWT_SECRET?.trim().replace(/^["']|["']$/g, '');
  if (!raw) throw new Error('HUB_JWT_SECRET ausente');
  return new TextEncoder().encode(raw);
}

const HUB_JWT_SECRET = getHubJwtSecret();
const TRACKFLOW_URL = (process.env.NEXT_PUBLIC_TRACKFLOW_URL ?? 'https://vnt-trackflow.azurewebsites.net').replace(/\/$/, '');

export async function GET(request: Request) {
  try {
    const context = await requireCorporateUser(request.headers.get('Authorization'));

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
      .sign(HUB_JWT_SECRET);

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

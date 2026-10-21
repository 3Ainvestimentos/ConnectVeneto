/**
 * Proxy server-side para `GET /api/summary` do Dados Estratégicos (módulo `portal-repasse`):
 * AuM, Churn e ROA do último fechamento, para o card "Indicadores Estratégicos" da Home.
 * Contrato: dados-estrategicos/vault/api-summary.md.
 *
 * Os números são da Vêneto como um todo e valem para todo usuário do Connect, mesmo sem acesso ao
 * módulo (decisão de 2026-10-21; o serviço só valida o token). Assina um Module Token de 60 s
 * (aud = portal-repasse) e chama o serviço de servidor para servidor. Qualquer resposta que não
 * seja 200 (timeout, serviço fora do ar) volta como `{ summary: null }` e a Home esconde o card.
 */
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { getHubJwtSecret } from '@/lib/hub-jwt';
import { getHubModuleServer } from '@/lib/hub-modules/server';
import { requireCorporateUser } from '@/lib/security';

const MODULE_ID = 'portal-repasse';
/** A primeira chamada a frio do serviço leva ~27 s; acima disso, desiste e esconde o card. */
const UPSTREAM_TIMEOUT_MS = 28_000;
export const maxDuration = 30;

const hidden = (reason: string) =>
  NextResponse.json({ summary: null, reason }, { headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request: Request) {
  try {
    const context = await requireCorporateUser(request.headers.get('Authorization'));
    const mod = await getHubModuleServer(MODULE_ID);
    if (!mod || mod.kind !== 'embedded' || !mod.enabled) return hidden('module-unavailable');

    const db = getFirestore(getFirebaseAdminApp());
    let snap = await db.collection('collaborators').where('authUid', '==', context.uid).limit(1).get();
    if (snap.empty && context.email) snap = await db.collection('collaborators').where('email', '==', context.email).limit(1).get();
    const collab = snap.empty ? null : snap.docs[0].data();

    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      email: context.email,
      name: (collab?.name as string | undefined) ?? context.email?.split('@')[0] ?? '',
      role: 'member',
      // Só para o resumo da Home: não dá acesso ao dashboard (o serviço não consulta permissões aqui).
      permissions: [],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(context.uid)
      .setIssuer('connect-veneto')
      .setAudience(MODULE_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(getHubJwtSecret());

    const res = await fetch(`${mod.url.replace(/\/$/, '')}/api/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }).catch(() => null);
    if (!res) return hidden('timeout');
    if (!res.ok) return hidden(`upstream-${res.status}`);

    const summary = await res.json().catch(() => null);
    if (!summary || typeof summary !== 'object') return hidden('invalid-response');
    // Dado de fechamento mensal: o navegador pode guardar por 1 h (mesmo cache do serviço).
    return NextResponse.json({ summary }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return hidden('error');
  }
}

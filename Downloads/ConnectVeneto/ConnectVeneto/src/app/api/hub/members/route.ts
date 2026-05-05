/**
 * Retorna a lista de colaboradores com acesso a um módulo específico.
 * Chamado server-to-server pelo módulo (TrackFlow, etc.) com um JWT assinado
 * pelo mesmo HUB_JWT_SECRET, porém com issuer=moduleId e audience='connect-veneto'.
 *
 * GET /api/hub/members?module=trackflow
 * Authorization: Bearer <jwt>
 */
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

function getHubJwtSecret() {
  const raw = process.env.HUB_JWT_SECRET?.trim().replace(/^["']|["']$/g, '');
  if (!raw) throw new Error('HUB_JWT_SECRET ausente');
  return new TextEncoder().encode(raw);
}

export type HubMember = {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  position?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const moduleId = searchParams.get('module');

  if (!moduleId) {
    return NextResponse.json({ error: 'Parâmetro module obrigatório' }, { status: 400 });
  }

  // Verifica JWT do módulo: issuer=moduleId, audience='connect-veneto'
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 401 });
  }

  try {
    await jwtVerify(auth.slice(7), getHubJwtSecret(), {
      issuer:   moduleId,
      audience: 'connect-veneto',
    });
  } catch {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
  }

  try {
    const db = getFirestore(getFirebaseAdminApp());
    const snapshot = await db.collection('collaborators').get();

    const members: HubMember[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Inclui colaboradores que têm permissões explícitas para o módulo
      // OU que não têm modulePermissions definidas (acesso geral — padrão para trackflow)
      const modulePerms: string[] | undefined = data.modulePermissions?.[moduleId];
      const hasAccess =
        modulePerms === undefined          // sem restrição por módulo — acesso geral
        || (Array.isArray(modulePerms) && modulePerms.length > 0);

      if (!hasAccess) return;
      if (!data.email || !data.name) return;

      members.push({
        uid:      data.authUid ?? doc.id,
        email:    data.email,
        name:     data.name,
        photoURL: data.photoURL ?? undefined,
        position: data.position ?? undefined,
      });
    });

    // Ordena por nome
    members.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[hub/members] erro ao buscar colaboradores:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

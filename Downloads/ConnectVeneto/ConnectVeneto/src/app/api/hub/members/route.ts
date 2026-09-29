/**
 * Retorna a lista de colaboradores com acesso a um módulo específico.
 * Chamado server-to-server pelo módulo (TrackFlow, etc.) com um JWT assinado
 * pelo mesmo HUB_JWT_SECRET, porém com issuer=moduleId e audience='connect-veneto'.
 *
 * GET /api/hub/members?module=trackflow
 * Authorization: Bearer <jwt>
 */
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { resolveModuleAccess } from '@/config/modules';
import { getHubModuleServer } from '@/lib/hub-modules/server';
import { verifyModuleRequest } from '@/lib/hub-jwt';

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
  if (!(await verifyModuleRequest(request, moduleId))) {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
  }

  const moduleConfig = await getHubModuleServer(moduleId);
  if (!moduleConfig || moduleConfig.kind !== 'embedded') {
    return NextResponse.json({ error: 'Módulo não registrado' }, { status: 404 });
  }

  try {
    const db = getFirestore(getFirebaseAdminApp());
    const snapshot = await db.collection('collaborators').get();

    const members: HubMember[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Mesma regra do token route e do menu (resolveModuleAccess).
      const modulePerms: string[] | undefined = data.modulePermissions?.[moduleId];
      if (!resolveModuleAccess(moduleConfig, modulePerms).hasAccess) return;
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

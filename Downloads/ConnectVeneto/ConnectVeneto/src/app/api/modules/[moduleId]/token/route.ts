/**
 * Emite um Module Token JWT para um módulo registrado em `hubModules`.
 * Chamado pelo ModuleEmbed quando recebe CV_REQUEST_AUTH ou CV_TOKEN_EXPIRED do iframe.
 * Ref: CONNECTVENETO_MODULE_PROTOCOL.md §10 e §14
 */
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getHubJwtSecret } from '@/lib/hub-jwt';
import { requireCorporateUser } from '@/lib/security';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { normalizeEmail } from '@/lib/email-utils';
import { moduleViewKey, resolveModuleAccess } from '@/config/modules';
import { getHubModuleServer } from '@/lib/hub-modules/server';

const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutos

async function isSuperAdmin(uid: string, email: string | null): Promise<boolean> {
  try {
    const db = getFirestore(getFirebaseAdminApp());
    const [adminDoc, configDoc] = await Promise.all([
      db.collection('systemSettings').doc('admin_config').get(),
      db.collection('systemSettings').doc('config').get(),
    ]);
    const adminEmails: string[] = [
      ...((adminDoc.data()?.superAdminEmails ?? []) as string[]),
      ...((configDoc.data()?.superAdminEmails ?? []) as string[]),
    ];
    if (!email) return false;
    return adminEmails.some((e) => normalizeEmail(e) === normalizeEmail(email));
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params;
    const moduleConfig = await getHubModuleServer(moduleId);
    if (!moduleConfig || moduleConfig.kind !== 'embedded') {
      return NextResponse.json({ error: 'Módulo não registrado' }, { status: 404 });
    }
    if (!moduleConfig.enabled) {
      return NextResponse.json({ error: 'Módulo desativado' }, { status: 404 });
    }

    const context = await requireCorporateUser(request.headers.get('Authorization'));

    // Lê body opcional (usado para simulação de usuário)
    let simulateAs: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.simulateAs === 'string' && body.simulateAs) {
        simulateAs = normalizeEmail(body.simulateAs) ?? undefined;
      }
    } catch { /* sem body — fluxo normal */ }

    const superAdmin = await isSuperAdmin(context.uid, context.email);

    // Simulação só permitida para super admins
    if (simulateAs && !superAdmin) {
      return NextResponse.json({ error: 'Simulação restrita a desenvolvedores' }, { status: 403 });
    }

    // Identidade efetiva: quem está sendo simulado ou o próprio requester
    const effectiveEmail = simulateAs ?? context.email;
    const role = superAdmin && !simulateAs ? 'superadmin' : 'member';

    let displayName = effectiveEmail?.split('@')[0] ?? '';
    let collabData: Record<string, unknown> | null = null;
    try {
      const db = getFirestore(getFirebaseAdminApp());
      let snap = simulateAs
        ? await db.collection('collaborators').where('email', '==', simulateAs).limit(1).get()
        : await db.collection('collaborators').where('authUid', '==', context.uid).limit(1).get();
      if (snap.empty && !simulateAs && context.email) {
        snap = await db.collection('collaborators').where('email', '==', context.email).limit(1).get();
      }
      if (!snap.empty) {
        collabData  = snap.docs[0].data() as Record<string, unknown>;
        displayName = (collabData.name as string | undefined) ?? displayName;
      }
    } catch {
      // Falha silenciosa — usa fallback
    }

    // Permissões da identidade efetiva — regra única em resolveModuleAccess (config/modules.ts).
    let permissions: string[];
    if (superAdmin && !simulateAs) {
      permissions = moduleConfig.adminPermissions;
    } else {
      const modulePerms = (collabData?.modulePermissions as Record<string, string[]> | undefined)?.[moduleConfig.id];
      const access = resolveModuleAccess(moduleConfig, modulePerms);
      if (access.hasAccess) {
        permissions = access.permissions;
      } else if (simulateAs) {
        // Super admin simulando alguém sem acesso: vê o módulo com o mínimo.
        permissions = moduleConfig.accessMode === 'explicit'
          ? [moduleViewKey(moduleConfig.id)]
          : moduleConfig.defaultPermissions;
      } else {
        return NextResponse.json(
          { error: `Acesso ao ${moduleConfig.label} não autorizado` },
          { status: 403 },
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      email:       effectiveEmail,
      name:        displayName,
      role,
      permissions,
      ...(simulateAs ? { simulatedBy: context.email } : {}),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(simulateAs ? `simulated:${context.uid}` : context.uid)
      .setIssuer('connect-veneto')
      .setAudience(moduleId)
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_TTL_SECONDS)
      .sign(getHubJwtSecret());

    return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

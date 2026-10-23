import { NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS, SYSTEM_PERMISSION_KEYS, type PermissionKey } from '@/lib/access/catalog';
import { readAccessProfiles, recomputeAccess } from '@/lib/access/server';
import { logSecurityEvent, requireCollaboratorAdmin, securityErrorResponse } from '@/lib/security';

const permissionKey = z.enum(PERMISSION_KEYS as [string, ...string[]]);
const moduleList = z.array(z.string().trim().min(1).max(80)).max(40);
const overridesSchema = z
  .object({
    permissions: z.record(permissionKey, z.boolean()).optional(),
    modules: z.record(z.string().trim().min(1).max(60), moduleList.nullable()).optional(),
  })
  .strict();
const patchSchema = z
  .object({
    // Acesso direto da pessoa (como está hoje: pessoa a pessoa).
    permissions: z.record(permissionKey, z.boolean()).optional(),
    /** Módulo: lista exata (`[]` = bloqueado) ou `null` = sem registro (padrão do módulo). */
    modulePermissions: z.record(z.string().trim().min(1).max(60), moduleList.nullable()).optional(),
    // Perfis de acesso (ADR 0005), ainda sem uso na tela.
    accessProfileId: z.string().trim().max(80).nullable().optional(),
    accessOverrides: overridesSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nada para atualizar.');

const ok = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const isSystem = (k: string) => SYSTEM_PERMISSION_KEYS.includes(k as PermissionKey);

/**
 * Acesso de uma pessoa (RH ou super admin): permissões e módulos direto, ou perfil e ajustes.
 * Itens do grupo Sistema (administração do sistema, auditoria) só um super admin mexe.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireCollaboratorAdmin(request.headers.get('Authorization'));
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return bad('Informe a pessoa.');
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const { permissions, modulePermissions, accessProfileId, accessOverrides } = parsed.data;

    const db = getFirestore(getFirebaseAdminApp());
    const ref = db.collection('collaborators').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 });
    const before = { ...DEFAULT_PERMISSIONS, ...(snap.get('permissions') ?? {}) } as Record<string, boolean>;

    if (!auth.isSuperAdmin && permissions && Object.entries(permissions).some(([k, v]) => isSystem(k) && before[k] !== v)) {
      return bad('Só um super admin mexe no acesso ao sistema.');
    }
    if (accessProfileId) {
      const profile = (await readAccessProfiles()).find((p) => p.id === accessProfileId);
      if (!profile) return bad('Esse perfil não existe mais.');
      if (!auth.isSuperAdmin && profile.permissions.some(isSystem)) return bad('Só um super admin atribui um perfil com acesso ao sistema.');
    }
    if (!auth.isSuperAdmin && accessOverrides?.permissions) {
      const prev = (snap.get('accessOverrides')?.permissions ?? {}) as Record<string, boolean>;
      const touched = Object.keys({ ...prev, ...accessOverrides.permissions }).filter(isSystem);
      if (touched.some((k) => prev[k] !== accessOverrides.permissions?.[k as PermissionKey])) return bad('Só um super admin mexe no acesso ao sistema.');
    }

    const update: Record<string, unknown> = {};
    const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
    if (permissions) {
      const next = { ...before, ...permissions };
      update.permissions = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, next[k] === true]));
      changes.push({ field: 'permissions', oldValue: snap.get('permissions') ?? null, newValue: update.permissions });
    }
    if (modulePermissions) {
      const current = { ...(snap.get('modulePermissions') ?? {}) } as Record<string, string[]>;
      for (const [mod, list] of Object.entries(modulePermissions)) {
        if (list === null) delete current[mod];
        else current[mod] = [...new Set(list)].sort();
      }
      update.modulePermissions = current;
      changes.push({ field: 'modulePermissions', oldValue: snap.get('modulePermissions') ?? null, newValue: current });
    }
    if (accessProfileId !== undefined) {
      update.accessProfileId = accessProfileId ? accessProfileId : FieldValue.delete();
      changes.push({ field: 'accessProfileId', oldValue: snap.get('accessProfileId') ?? null, newValue: accessProfileId || null });
    }
    if (accessOverrides !== undefined) {
      const empty = !accessOverrides || (!Object.keys(accessOverrides.permissions ?? {}).length && !Object.keys(accessOverrides.modules ?? {}).length);
      update.accessOverrides = empty ? FieldValue.delete() : accessOverrides;
      changes.push({ field: 'accessOverrides', oldValue: snap.get('accessOverrides') ?? null, newValue: empty ? null : accessOverrides });
    }

    const batch = db.batch();
    batch.update(ref, update);
    batch.create(db.collection('collaborator_logs').doc(), {
      collaboratorId: id,
      collaboratorName: snap.get('name') ?? '',
      updatedBy: auth.email ?? 'desconhecido',
      updatedAt: new Date().toISOString(),
      source: 'access',
      changes,
    });
    batch.update(db.collection('systemSettings').doc('config'), { collaboratorTableVersion: FieldValue.increment(1) });
    await batch.commit();
    // Com perfil (ADR 0005), o acesso efetivo é recalculado; sem perfil, vale o gravado acima.
    await recomputeAccess({ by: auth.email ?? 'desconhecido', only: [id] });
    return ok({ ok: true });
  } catch (error) {
    const known = securityErrorResponse(error);
    if (known) return known;
    logSecurityEvent('[api/admin/access/people] falha', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Não foi possível salvar o acesso.' }, { status: 500 });
  }
}

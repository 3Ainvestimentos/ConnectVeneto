/**
 * Perfis de acesso no servidor (ADR 0005): leitura dos perfis e o recálculo que grava o acesso
 * efetivo em `collaborators.permissions` e `modulePermissions` (o que páginas, APIs e tokens leem).
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { readOrgUnits } from '@/lib/hub/org-units-server';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS, type PermissionKey } from './catalog';
import { ACCESS_PROFILES_COLLECTION, effectiveAccess, resolveProfile, sameAccess, type AccessOverrides, type AccessProfile } from './profiles';

const db = () => getFirestore(getFirebaseAdminApp());

export async function readAccessProfiles(): Promise<AccessProfile[]> {
  const snap = await db().collection(ACCESS_PROFILES_COLLECTION).get();
  return snap.docs
    .map((d) => {
      const v = d.data();
      return {
        id: d.id,
        name: String(v.name ?? d.id),
        ...(v.description ? { description: String(v.description) } : {}),
        permissions: (Array.isArray(v.permissions) ? v.permissions : []).filter((k: unknown): k is PermissionKey => PERMISSION_KEYS.includes(k as PermissionKey)),
        modules: v.modules && typeof v.modules === 'object' ? (v.modules as Record<string, string[]>) : {},
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Recalcula o acesso de todos (ou de `only`) e grava só o que mudou, com log. Quem não tem perfil
 * (nem próprio, nem pela unidade) fica como está. `dryRun` só conta.
 */
export async function recomputeAccess(opts: { by: string; only?: string[]; dryRun?: boolean }): Promise<{ changed: { id: string; name: string }[] }> {
  const [profiles, units, collabSnap] = await Promise.all([readAccessProfiles(), readOrgUnits(), db().collection('collaborators').get()]);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const profileIds = new Set(byId.keys());
  const only = opts.only ? new Set(opts.only) : null;
  const now = new Date().toISOString();

  const writes: { ref: FirebaseFirestore.DocumentReference; id: string; name: string; data: Record<string, unknown>; changes: unknown[] }[] = [];
  for (const d of collabSnap.docs) {
    if (only && !only.has(d.id)) continue;
    const c = d.data();
    const source = resolveProfile({ accessProfileId: c.accessProfileId, unitId: c.unitId }, unitMap, profileIds);
    if (!source.profileId) continue;
    const eff = effectiveAccess(byId.get(source.profileId)!, (c.accessOverrides ?? {}) as AccessOverrides);
    if (sameAccess(eff, { permissions: c.permissions, modulePermissions: c.modulePermissions }, DEFAULT_PERMISSIONS)) continue;
    writes.push({
      ref: d.ref,
      id: d.id,
      name: String(c.name ?? ''),
      data: { permissions: eff.permissions, modulePermissions: eff.modulePermissions },
      changes: [
        { field: 'permissions', oldValue: c.permissions ?? null, newValue: eff.permissions },
        { field: 'modulePermissions', oldValue: c.modulePermissions ?? null, newValue: eff.modulePermissions },
      ],
    });
  }

  if (!opts.dryRun && writes.length > 0) {
    for (let i = 0; i < writes.length; i += 200) {
      const batch = db().batch();
      for (const w of writes.slice(i, i + 200)) {
        batch.update(w.ref, w.data);
        batch.create(db().collection('collaborator_logs').doc(), {
          collaboratorId: w.id,
          collaboratorName: w.name,
          updatedBy: opts.by,
          updatedAt: now,
          source: 'access-profiles',
          changes: w.changes,
        });
      }
      await batch.commit();
    }
    // As telas abertas recarregam o cadastro quando a versão sobe.
    await db().collection('systemSettings').doc('config').update({ collaboratorTableVersion: FieldValue.increment(1) });
  }
  return { changed: writes.map(({ id, name }) => ({ id, name })) };
}

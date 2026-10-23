import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { PERMISSION_KEYS } from '@/lib/access/catalog';
import { ACCESS_PROFILES_COLLECTION } from '@/lib/access/profiles';
import { readAccessProfiles, recomputeAccess } from '@/lib/access/server';
import { ORG_UNITS_COLLECTION } from '@/lib/hub/org-units-server';
import { logSecurityEvent, requireCollaboratorAdmin, requireSuperAdmin, securityErrorResponse } from '@/lib/security';

const permissionKey = z.enum(PERMISSION_KEYS as [string, ...string[]]);
const modulesSchema = z.record(z.string().trim().min(1).max(60), z.array(z.string().trim().min(1).max(80)).max(40));
const fields = {
  name: z.string().trim().min(1, 'Dê um nome ao perfil.').max(60),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(permissionKey).max(PERMISSION_KEYS.length),
  modules: modulesSchema,
};
const createSchema = z.object(fields).strict();
const updateSchema = z.object({ id: z.string().trim().min(1), ...fields }).partial().required({ id: true }).strict();
const deleteSchema = z.object({ id: z.string().trim().min(1) }).strict();

const ok = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const db = () => getFirestore(getFirebaseAdminApp());

function handle(error: unknown, action: string) {
  const known = securityErrorResponse(error);
  if (known) return known;
  logSecurityEvent(`[api/admin/access/profiles] falha (${action})`, { error: error instanceof Error ? error.message : 'unknown' });
  return NextResponse.json({ error: 'Não foi possível salvar o perfil.' }, { status: 500 });
}

/** Perfis de acesso (RH lê para atribuir; só super admin cria e edita). */
export async function GET(request: Request) {
  try {
    await requireCollaboratorAdmin(request.headers.get('Authorization'));
    return ok({ profiles: await readAccessProfiles() });
  } catch (error) {
    return handle(error, 'GET');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin(request.headers.get('Authorization'));
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const now = new Date().toISOString();
    const ref = await db().collection(ACCESS_PROFILES_COLLECTION).add({ ...parsed.data, createdAt: now, updatedAt: now, updatedBy: auth.email });
    return ok({ id: ref.id });
  } catch (error) {
    return handle(error, 'POST');
  }
}

/** Mudou o pacote: recalcula quem usa o perfil (todos, por simplicidade: são poucas dezenas). */
export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin(request.headers.get('Authorization'));
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const { id, ...patch } = parsed.data;
    const ref = db().collection(ACCESS_PROFILES_COLLECTION).doc(id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });
    await ref.update({ ...patch, updatedAt: new Date().toISOString(), updatedBy: auth.email });
    const { changed } = await recomputeAccess({ by: auth.email ?? 'super admin' });
    return ok({ ok: true, changed: changed.length });
  } catch (error) {
    return handle(error, 'PATCH');
  }
}

/** Só apaga perfil sem uso (nenhuma unidade e nenhuma pessoa com ele). */
export async function DELETE(request: Request) {
  try {
    await requireSuperAdmin(request.headers.get('Authorization'));
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad('Informe o perfil.');
    const { id } = parsed.data;
    const [units, people] = await Promise.all([
      db().collection(ORG_UNITS_COLLECTION).where('accessProfileId', '==', id).limit(1).get(),
      db().collection('collaborators').where('accessProfileId', '==', id).limit(1).get(),
    ]);
    if (!units.empty || !people.empty) return bad('O perfil ainda está em uso. Troque o perfil das unidades e pessoas antes.');
    await db().collection(ACCESS_PROFILES_COLLECTION).doc(id).delete();
    return ok({ ok: true });
  } catch (error) {
    return handle(error, 'DELETE');
  }
}

import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ORG_UNITS_COLLECTION, readOrgUnits } from '@/lib/hub/org-units-server';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { canBeChildOf, isSameOrDescendant, UNIT_TYPES, UNIT_TYPE_LABEL, type OrgUnit, type UnitType } from '@/lib/hub/org-units';
import { logSecurityEvent, requireCollaboratorAdmin, securityErrorResponse } from '@/lib/security';

const LOG_COLLECTION = 'orgUnitLogs';

const fields = {
  name: z.string().trim().min(1, 'Dê um nome à unidade.').max(120),
  type: z.enum(UNIT_TYPES),
  parentId: z.string().trim().max(80).nullable(),
  leaderIdVeneto: z.string().trim().max(60).nullable(),
};
const createSchema = z.object(fields).strict();
const updateSchema = z.object({ id: z.string().trim().min(1), ...fields }).partial().required({ id: true }).strict();
const deleteSchema = z.object({ id: z.string().trim().min(1) }).strict();

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const ok = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

/** Hierarquia válida: tipo compatível com a mãe e sem ciclo. Responsável precisa existir. */
async function validate(units: OrgUnit[], unit: Omit<OrgUnit, 'id'> & { id?: string }): Promise<string | null> {
  const map = new Map(units.map((u) => [u.id, u]));
  const parent = unit.parentId ? map.get(unit.parentId) : null;
  if (unit.parentId && !parent) return 'A unidade-mãe não existe.';
  if (!canBeChildOf(unit.type, parent?.type ?? null)) {
    return parent
      ? `Uma ${UNIT_TYPE_LABEL[unit.type]} não pode ficar dentro de uma ${UNIT_TYPE_LABEL[parent.type]}.`
      : `Uma ${UNIT_TYPE_LABEL[unit.type]} precisa ficar dentro de uma Área ou Diretoria.`;
  }
  if (unit.id && unit.parentId && isSameOrDescendant(map, unit.parentId, unit.id)) return 'Não dá para colocar a unidade dentro dela mesma.';
  // Filhas que ficariam inválidas com o novo tipo.
  if (unit.id) {
    const child = units.find((u) => u.parentId === unit.id && !canBeChildOf(u.type, unit.type));
    if (child) return `"${child.name}" (${UNIT_TYPE_LABEL[child.type]}) não pode ficar dentro de uma ${UNIT_TYPE_LABEL[unit.type]}.`;
  }
  if (unit.leaderIdVeneto) {
    const db = getFirestore(getFirebaseAdminApp());
    const leader = await db.collection('collaborators').where('idVeneto', '==', unit.leaderIdVeneto).limit(1).get();
    if (leader.empty) return 'O responsável escolhido não está no cadastro.';
  }
  return null;
}

async function log(email: string | null, action: string, unitId: string, data: unknown) {
  await getFirestore(getFirebaseAdminApp())
    .collection(LOG_COLLECTION)
    .add({ action, unitId, data, by: email ?? 'desconhecido', at: new Date().toISOString() });
}

function handle(error: unknown, action: string) {
  const known = securityErrorResponse(error);
  if (known) return known;
  logSecurityEvent(`[api/admin/org-units] falha (${action})`, { error: error instanceof Error ? error.message : 'unknown' });
  return NextResponse.json({ error: 'Não foi possível salvar a estrutura.' }, { status: 500 });
}

/** Cria unidade (RH = admin do cadastro, ou super admin). */
export async function POST(request: Request) {
  try {
    const auth = await requireCollaboratorAdmin(request.headers.get('Authorization'));
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const problem = await validate(await readOrgUnits(), parsed.data);
    if (problem) return bad(problem);
    const now = new Date().toISOString();
    const ref = await getFirestore(getFirebaseAdminApp())
      .collection(ORG_UNITS_COLLECTION)
      .add({ ...parsed.data, createdAt: now, updatedAt: now, updatedBy: auth.email });
    await log(auth.email, 'create', ref.id, parsed.data);
    return ok({ id: ref.id });
  } catch (error) {
    return handle(error, 'POST');
  }
}

/** Renomeia, muda tipo, move de mãe ou troca o responsável. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireCollaboratorAdmin(request.headers.get('Authorization'));
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const { id, ...patch } = parsed.data;
    const units = await readOrgUnits();
    const current = units.find((u) => u.id === id);
    if (!current) return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 });
    const next = { ...current, ...patch, type: (patch.type ?? current.type) as UnitType };
    const problem = await validate(units, next);
    if (problem) return bad(problem);
    await getFirestore(getFirebaseAdminApp())
      .collection(ORG_UNITS_COLLECTION)
      .doc(id)
      .update({ ...patch, updatedAt: new Date().toISOString(), updatedBy: auth.email });
    await log(auth.email, 'update', id, patch);
    return ok({ ok: true });
  } catch (error) {
    return handle(error, 'PATCH');
  }
}

/** Exclui unidade vazia (sem unidades filhas e sem pessoas). */
export async function DELETE(request: Request) {
  try {
    const auth = await requireCollaboratorAdmin(request.headers.get('Authorization'));
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad('Informe a unidade.');
    const { id } = parsed.data;
    const units = await readOrgUnits();
    if (units.some((u) => u.parentId === id)) return bad('Mova ou exclua as unidades de dentro antes.');
    const db = getFirestore(getFirebaseAdminApp());
    const members = await db.collection('collaborators').where('unitId', '==', id).limit(1).get();
    if (!members.empty) return bad('Ainda há pessoas nesta unidade. Mova-as antes de excluir.');
    await db.collection(ORG_UNITS_COLLECTION).doc(id).delete();
    await log(auth.email, 'delete', id, null);
    return ok({ ok: true });
  } catch (error) {
    return handle(error, 'DELETE');
  }
}

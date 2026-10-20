import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { logSecurityEvent, requireSuperAdmin, securityErrorResponse } from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  CONSULTA_LINK_TYPES_COLLECTION,
  CONSULTA_LINKS_COLLECTION,
  linkTypeFieldsSchema,
} from '@/config/consulta-links';

/**
 * Tipos de link da Consulta Pessoal (MESA, CX...) e seus administradores.
 * Só super admin cria, edita e exclui tipos; os admins de cada tipo cuidam dos
 * links em `/api/consulta/links`.
 */
const updatePayloadSchema = linkTypeFieldsSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nada para atualizar.');

const invalidRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

const jsonOk = (body: Record<string, unknown>) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  logSecurityEvent(`[api/consulta/types] ${knownSecurityError ? 'security' : 'unexpected'} error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return knownSecurityError ?? NextResponse.json({ error: 'Falha ao salvar o tipo de link.' }, { status: 500 });
};

const typeIdFrom = (request: Request) => new URL(request.url).searchParams.get('id')?.trim() || null;

export async function POST(request: Request) {
  try {
    const context = await requireSuperAdmin(request.headers.get('Authorization'));

    const parsed = linkTypeFieldsSchema.strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const types = getFirestore(getFirebaseAdminApp()).collection(CONSULTA_LINK_TYPES_COLLECTION);
    const all = await types.get();
    const sameName = all.docs.some(
      (doc) => String(doc.data().name ?? '').toLowerCase() === parsed.data.name.toLowerCase()
    );
    if (sameName) return invalidRequest('Já existe um tipo com este nome.');

    const now = new Date().toISOString();
    const docRef = types.doc();
    await docRef.set({ ...parsed.data, createdAt: now, updatedAt: now, updatedByEmail: context.email });

    logSecurityEvent('[api/consulta/types] tipo criado', {
      email: context.email,
      typeId: docRef.id,
      admins: parsed.data.adminEmails.join(','),
      adminAreas: parsed.data.adminAreas.join(','),
    });
    return jsonOk({ ok: true, id: docRef.id });
  } catch (error) {
    return handleError(error, 'POST');
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireSuperAdmin(request.headers.get('Authorization'));
    const id = typeIdFrom(request);
    if (!id) return invalidRequest('Informe o id do tipo.');

    const parsed = updatePayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const types = getFirestore(getFirebaseAdminApp()).collection(CONSULTA_LINK_TYPES_COLLECTION);
    const docRef = types.doc(id);
    if (!(await docRef.get()).exists) {
      return NextResponse.json({ error: 'Tipo não encontrado.' }, { status: 404 });
    }

    if (parsed.data.name) {
      const name = parsed.data.name.toLowerCase();
      const all = await types.get();
      if (all.docs.some((doc) => doc.id !== id && String(doc.data().name ?? '').toLowerCase() === name)) {
        return invalidRequest('Já existe um tipo com este nome.');
      }
    }

    await docRef.update({ ...parsed.data, updatedAt: new Date().toISOString(), updatedByEmail: context.email });

    logSecurityEvent('[api/consulta/types] tipo editado', {
      email: context.email,
      typeId: id,
      fields: Object.keys(parsed.data).join(','),
      ...(parsed.data.adminEmails ? { admins: parsed.data.adminEmails.join(',') } : {}),
      ...(parsed.data.adminAreas ? { adminAreas: parsed.data.adminAreas.join(',') } : {}),
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'PATCH');
  }
}

/** Só exclui tipo vazio: apagar em cascata os links de várias pessoas é fácil demais por engano. */
export async function DELETE(request: Request) {
  try {
    const context = await requireSuperAdmin(request.headers.get('Authorization'));
    const id = typeIdFrom(request);
    if (!id) return invalidRequest('Informe o id do tipo.');

    const db = getFirestore(getFirebaseAdminApp());
    const inUse = await db.collection(CONSULTA_LINKS_COLLECTION).where('typeId', '==', id).limit(1).get();
    if (!inUse.empty) {
      return invalidRequest('Este tipo ainda tem links. Exclua os links antes de excluir o tipo.');
    }

    await db.collection(CONSULTA_LINK_TYPES_COLLECTION).doc(id).delete();

    logSecurityEvent('[api/consulta/types] tipo excluido', { email: context.email, typeId: id });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

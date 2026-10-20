import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logSecurityEvent, requireCorporateUser, securityErrorResponse } from '@/lib/security';
import {
  audienceSchema,
  CONSULTA_LINK_VALUES_COLLECTION,
  CONSULTA_LINKS_COLLECTION,
  isInAudience,
  linkUrlSchema,
  typedLinkSchema,
  type TypeAdminData,
} from '@/config/consulta-links';
import {
  canAdminType,
  consultaDb,
  loadAllMembers,
  resolveConsultaAccess,
  toLink,
  toLinkValue,
} from '@/lib/consulta-links';

/**
 * Administração dos links de um tipo (MESA, CX...): links Individual (cada pessoa
 * cadastrada tem sua URL; quem não tem não vê) e Compartilhado (mesma URL para o
 * Público). Links pessoais nunca aparecem aqui — nem para super admin.
 */
const createPayloadSchema = z
  .object({ typeId: z.string().trim().min(1).max(100) })
  .passthrough()
  .transform(({ typeId, ...fields }, ctx) => {
    const parsed = typedLinkSchema.safeParse(fields);
    if (!parsed.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? 'Requisicao invalida.' });
      return z.NEVER;
    }
    return { typeId, ...parsed.data };
  });

const updatePayloadSchema = z
  .object({
    title: z.string().trim().min(1, 'Informe um nome para o link.').max(120, 'Nome muito longo.'),
    description: z.string().trim().max(300, 'Descrição muito longa.'),
    url: linkUrlSchema,
    audience: audienceSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nada para atualizar.');

const invalidRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

const jsonOk = (body: unknown) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  logSecurityEvent(`[api/consulta/admin/links] ${knownSecurityError ? 'security' : 'unexpected'} error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return knownSecurityError ?? NextResponse.json({ error: 'Falha ao processar o link.' }, { status: 500 });
};

const getAccess = async (request: Request) =>
  resolveConsultaAccess(await requireCorporateUser(request.headers.get('Authorization')));

/** Links do tipo, URLs individuais e quem vê cada link hoje (Público do Compartilhado, donos de URL do Individual). */
export async function GET(request: Request) {
  try {
    const access = await getAccess(request);
    const typeId = new URL(request.url).searchParams.get('typeId')?.trim();
    if (!typeId) return invalidRequest('Informe o tipo de link.');
    if (!canAdminType(access, typeId)) throw new Error('FORBIDDEN_CONSULTA_TYPE_ADMIN_REQUIRED');

    const db = consultaDb();
    const [links, values, members] = await Promise.all([
      db.collection(CONSULTA_LINKS_COLLECTION).where('typeId', '==', typeId).get(),
      db.collection(CONSULTA_LINK_VALUES_COLLECTION).where('typeId', '==', typeId).get(),
      loadAllMembers(),
    ]);
    const linkValues = values.docs.map((doc) => toLinkValue(doc.id, doc.data()));

    const body: TypeAdminData = {
      links: links.docs
        .map((doc) => toLink(doc.id, doc.data()))
        .filter((link) => link.kind !== 'personal')
        .map((link) => ({
          ...link,
          members: link.kind === 'shared'
            ? members.filter((member) => isInAudience(link.audience, member)).map((member) => member.email)
            : linkValues.filter((value) => value.linkId === link.id).map((value) => value.ownerEmail),
        })),
      values: linkValues,
    };
    return jsonOk(body);
  } catch (error) {
    return handleError(error, 'GET');
  }
}

export async function POST(request: Request) {
  try {
    const access = await getAccess(request);

    const parsed = createPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const { typeId, ...fields } = parsed.data;
    if (!access.types.some((type) => type.id === typeId)) return invalidRequest('Tipo de link inexistente.');
    if (!canAdminType(access, typeId)) throw new Error('FORBIDDEN_CONSULTA_TYPE_ADMIN_REQUIRED');

    const now = new Date().toISOString();
    const docRef = consultaDb().collection(CONSULTA_LINKS_COLLECTION).doc();
    await docRef.set({
      url: '',
      audience: null,
      ...fields,
      typeId,
      ownerEmail: null,
      createdByEmail: access.email,
      createdAt: now,
      updatedByEmail: access.email,
      updatedAt: now,
    });

    logSecurityEvent('[api/consulta/admin/links] link criado', {
      email: access.email,
      typeId,
      linkId: docRef.id,
      kind: fields.kind,
    });
    return jsonOk({ ok: true, id: docRef.id });
  } catch (error) {
    return handleError(error, 'POST');
  }
}

const loadTypedLink = async (request: Request) => {
  const access = await getAccess(request);
  const id = new URL(request.url).searchParams.get('id')?.trim();
  if (!id) return { error: invalidRequest('Informe o id do link.') } as const;

  const docRef = consultaDb().collection(CONSULTA_LINKS_COLLECTION).doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) return { error: NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 }) } as const;

  const link = toLink(id, snapshot.data() ?? {});
  if (link.kind === 'personal' || !link.typeId || !canAdminType(access, link.typeId)) {
    throw new Error('FORBIDDEN_CONSULTA_TYPE_ADMIN_REQUIRED');
  }
  return { access, docRef, link } as const;
};

export async function PATCH(request: Request) {
  try {
    const loaded = await loadTypedLink(request);
    if ('error' in loaded) return loaded.error;

    const parsed = updatePayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }
    if (parsed.data.url !== undefined && loaded.link.kind === 'individual') {
      return invalidRequest('Link individual não tem URL única: edite a URL de cada pessoa.');
    }
    if (parsed.data.audience !== undefined && loaded.link.kind === 'individual') {
      return invalidRequest('Link individual não tem público: ele aparece só para quem tem URL cadastrada.');
    }

    await loaded.docRef.update({
      ...parsed.data,
      updatedByEmail: loaded.access.email,
      updatedAt: new Date().toISOString(),
    });

    logSecurityEvent('[api/consulta/admin/links] link editado', {
      email: loaded.access.email,
      linkId: loaded.link.id,
      fields: Object.keys(parsed.data).join(','),
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'PATCH');
  }
}

/** Excluir um link Individual leva junto as URLs de cada pessoa. */
export async function DELETE(request: Request) {
  try {
    const loaded = await loadTypedLink(request);
    if ('error' in loaded) return loaded.error;

    const db = consultaDb();
    const values = await db.collection(CONSULTA_LINK_VALUES_COLLECTION).where('linkId', '==', loaded.link.id).get();
    const batch = db.batch();
    values.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(loaded.docRef);
    await batch.commit();

    logSecurityEvent('[api/consulta/admin/links] link excluido', {
      email: loaded.access.email,
      linkId: loaded.link.id,
      values: values.size,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logSecurityEvent, requireCorporateUser, securityErrorResponse } from '@/lib/security';
import {
  CONSULTA_LINK_VALUES_COLLECTION,
  CONSULTA_LINKS_COLLECTION,
  linkUrlSchema,
  valueDocId,
} from '@/config/consulta-links';
import { canAdminType, consultaDb, resolveConsultaAccess, toLink } from '@/lib/consulta-links';

/**
 * URL de uma pessoa num link Individual ("Planilha MESA" da Ana). Só admins do
 * tipo do link gravam e apagam.
 */
const emailSchema = z.string().trim().toLowerCase().email('E-mail do colaborador inválido.');

const putPayloadSchema = z
  .object({ linkId: z.string().trim().min(1).max(200), ownerEmail: emailSchema, url: linkUrlSchema })
  .strict();

const invalidRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

const jsonOk = (body: unknown) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  logSecurityEvent(`[api/consulta/admin/values] ${knownSecurityError ? 'security' : 'unexpected'} error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return knownSecurityError ?? NextResponse.json({ error: 'Falha ao salvar a URL.' }, { status: 500 });
};

/** Confere que o link é Individual e que quem pede administra o tipo dele. */
const loadIndividualLink = async (request: Request, linkId: string) => {
  const access = await resolveConsultaAccess(await requireCorporateUser(request.headers.get('Authorization')));
  const snapshot = await consultaDb().collection(CONSULTA_LINKS_COLLECTION).doc(linkId).get();
  if (!snapshot.exists) return { error: NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 }) } as const;

  const link = toLink(linkId, snapshot.data() ?? {});
  if (link.kind !== 'individual' || !link.typeId) return { error: invalidRequest('Este link não tem URL por pessoa.') } as const;
  if (!canAdminType(access, link.typeId)) throw new Error('FORBIDDEN_CONSULTA_TYPE_ADMIN_REQUIRED');
  return { access, link } as const;
};

export async function PUT(request: Request) {
  try {
    const parsed = putPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const { linkId, ownerEmail, url } = parsed.data;
    const loaded = await loadIndividualLink(request, linkId);
    if ('error' in loaded) return loaded.error;

    const db = consultaDb();
    const collaborator = await db.collection('collaborators').where('email', '==', ownerEmail).limit(1).get();
    if (collaborator.empty) return invalidRequest('Colaborador não encontrado.');

    await db.collection(CONSULTA_LINK_VALUES_COLLECTION).doc(valueDocId(linkId, ownerEmail)).set({
      linkId,
      typeId: loaded.link.typeId,
      ownerEmail,
      url,
      updatedAt: new Date().toISOString(),
      updatedByEmail: loaded.access.email,
    });

    logSecurityEvent('[api/consulta/admin/values] url gravada', {
      email: loaded.access.email,
      linkId,
      ownerEmail,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'PUT');
  }
}

export async function DELETE(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const linkId = params.get('linkId')?.trim();
    const ownerEmail = emailSchema.safeParse(params.get('ownerEmail') ?? '');
    if (!linkId || !ownerEmail.success) return invalidRequest('Informe o link e o colaborador.');

    const loaded = await loadIndividualLink(request, linkId);
    if ('error' in loaded) return loaded.error;

    await consultaDb().collection(CONSULTA_LINK_VALUES_COLLECTION).doc(valueDocId(linkId, ownerEmail.data)).delete();

    logSecurityEvent('[api/consulta/admin/values] url removida', {
      email: loaded.access.email,
      linkId,
      ownerEmail: ownerEmail.data,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

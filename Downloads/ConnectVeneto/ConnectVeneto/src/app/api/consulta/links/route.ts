import { NextResponse } from 'next/server';
import { logSecurityEvent, requireCorporateUser, securityErrorResponse } from '@/lib/security';
import {
  CONSULTA_LINK_VALUES_COLLECTION,
  CONSULTA_LINKS_COLLECTION,
  isInAudience,
  linkFieldsSchema,
  MAX_PERSONAL_LINKS,
  type ConsultaLinksSession,
  type MyConsultaLink,
} from '@/config/consulta-links';
import { consultaDb, resolveConsultaAccess, toLink, toLinkValue } from '@/lib/consulta-links';

/**
 * Consulta Pessoal da pessoa logada: GET traz tudo o que ela vê; POST/PATCH/DELETE
 * mexem só nos links pessoais dela. Links de tipo ficam em `/api/consulta/admin`.
 */
const createPayloadSchema = linkFieldsSchema.strict();

const updatePayloadSchema = linkFieldsSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nada para atualizar.');

const invalidRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const notFound = () => NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 });

const jsonOk = (body: unknown) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  logSecurityEvent(`[api/consulta/links] ${knownSecurityError ? 'security' : 'unexpected'} error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return knownSecurityError ?? NextResponse.json({ error: 'Falha ao processar o link.' }, { status: 500 });
};

const getAccess = async (request: Request) =>
  resolveConsultaAccess(await requireCorporateUser(request.headers.get('Authorization')));

/**
 * Links pessoais + Compartilhados cujo Público inclui a pessoa hoje (empresa toda,
 * área ou equipe atuais do cadastro, ou o e-mail dela) + Individuais em que o admin
 * cadastrou uma URL para ela.
 */
export async function GET(request: Request) {
  try {
    const access = await getAccess(request);
    const db = consultaDb();
    const links = db.collection(CONSULTA_LINKS_COLLECTION);

    const [personal, typed, values] = await Promise.all([
      links.where('ownerEmail', '==', access.email).get(),
      links.where('kind', 'in', ['individual', 'shared']).get(),
      db.collection(CONSULTA_LINK_VALUES_COLLECTION).where('ownerEmail', '==', access.email).get(),
    ]);

    const myUrls = new Map(values.docs.map((doc) => {
      const value = toLinkValue(doc.id, doc.data());
      return [value.linkId, value.url] as const;
    }));

    const visible: MyConsultaLink[] = [
      ...personal.docs.map((doc) => toLink(doc.id, doc.data())).filter((link) => link.kind === 'personal'),
      ...typed.docs
        .map((doc) => toLink(doc.id, doc.data()))
        .flatMap((link) => {
          if (link.kind === 'individual') {
            const url = myUrls.get(link.id);
            return url ? [{ ...link, url }] : [];
          }
          return isInAudience(link.audience, access.member) ? [link] : [];
        }),
    ].map(({ audience: _audience, ...link }) => link);

    const body: ConsultaLinksSession = {
      links: visible.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
      types: access.types,
      adminTypeIds: access.adminTypeIds,
      isSuperAdmin: access.isSuperAdmin,
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

    const links = consultaDb().collection(CONSULTA_LINKS_COLLECTION);
    const existing = await links.where('ownerEmail', '==', access.email).get();
    if (existing.size >= MAX_PERSONAL_LINKS) {
      return invalidRequest(`Você já tem ${MAX_PERSONAL_LINKS} links pessoais. Exclua algum para salvar outro.`);
    }

    const now = new Date().toISOString();
    const docRef = links.doc();
    await docRef.set({
      ...parsed.data,
      kind: 'personal',
      typeId: null,
      ownerEmail: access.email,
      createdByEmail: access.email,
      createdAt: now,
      updatedByEmail: access.email,
      updatedAt: now,
    });

    return jsonOk({ ok: true, id: docRef.id });
  } catch (error) {
    return handleError(error, 'POST');
  }
}

/** Só o dono mexe no link pessoal — nem super admin. */
const loadOwnLink = async (request: Request) => {
  const access = await getAccess(request);
  const id = new URL(request.url).searchParams.get('id')?.trim();
  if (!id) return { error: invalidRequest('Informe o id do link.') } as const;

  const docRef = consultaDb().collection(CONSULTA_LINKS_COLLECTION).doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) return { error: notFound() } as const;

  const link = toLink(id, snapshot.data() ?? {});
  if (link.kind !== 'personal' || link.ownerEmail !== access.email) throw new Error('FORBIDDEN_CONSULTA_LINK');

  return { access, docRef } as const;
};

export async function PATCH(request: Request) {
  try {
    const loaded = await loadOwnLink(request);
    if ('error' in loaded) return loaded.error;

    const parsed = updatePayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    await loaded.docRef.update({
      ...parsed.data,
      updatedByEmail: loaded.access.email,
      updatedAt: new Date().toISOString(),
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'PATCH');
  }
}

export async function DELETE(request: Request) {
  try {
    const loaded = await loadOwnLink(request);
    if ('error' in loaded) return loaded.error;

    await loaded.docRef.delete();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

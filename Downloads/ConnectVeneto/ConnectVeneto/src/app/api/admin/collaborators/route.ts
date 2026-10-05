import { NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  isSuperAdminAddress,
  logSecurityEvent,
  requireCollaboratorAdmin,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

const COLLECTION_NAME = 'collaborators';
const LOG_COLLECTION_NAME = 'collaborator_logs';

/**
 * Edição e exclusão de colaboradores pelo RH.
 *
 * As rules de `collaborators` só deixam super admin editar/excluir. Em vez de abrir
 * a rule para o RH, a escrita passa por aqui (Admin SDK), onde dá para checar o
 * que a rule não checa: e-mail único, cadastro de super admin intocável pelo RH e
 * o log de auditoria gravado pelo servidor, não pelo client.
 *
 * Só campos de cadastro: `permissions`, `modulePermissions`, `authUid` e afins
 * continuam na tela de permissões (super admin). `.strict()` recusa qualquer outro.
 */
/** Vazio ou http(s) — o formulário aceita os dois; `javascript:` e afins, não. */
const optionalUrl = z.string().trim().max(2048).refine(
  (value) => value === '' || /^https?:\/\/[^\s]+$/i.test(value),
  'URL inválida.'
);

const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} é obrigatório.`).max(300);

const profilePatchSchema = z
  .object({
    idVeneto: requiredText('ID Veneto'),
    name: requiredText('Nome'),
    email: z.string().trim().toLowerCase().email('E-mail inválido.'),
    photoURL: optionalUrl,
    axis: requiredText('Eixo'),
    area: requiredText('Área'),
    position: requiredText('Cargo'),
    segment: requiredText('Segmento'),
    leader: requiredText('Líder'),
    lideranca: z.string().trim().max(50),
    city: requiredText('Cidade'),
    consultaLinks: z
      .object({ mesa: optionalUrl, cliente: optionalUrl, cx: optionalUrl })
      .strict(),
  })
  .strict()
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nada para atualizar.');

const invalidRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

const jsonOk = (body: Record<string, unknown>) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  if (knownSecurityError) {
    logSecurityEvent(`[api/admin/collaborators] security error (${action})`, {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return knownSecurityError;
  }

  logSecurityEvent(`[api/admin/collaborators] unexpected error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return NextResponse.json({ error: 'Falha ao salvar o colaborador.' }, { status: 500 });
};

/** O RH não mexe no cadastro de super admin — só outro super admin. */
const forbiddenSuperAdminTarget = () =>
  NextResponse.json(
    { error: 'Acesso negado: o cadastro de um super administrador só pode ser alterado por outro super administrador.' },
    { status: 403 }
  );

export async function PATCH(request: Request) {
  try {
    const authContext = await requireCollaboratorAdmin(request.headers.get('Authorization'));

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return invalidRequest('Informe o id do colaborador.');

    const rawBody = await request.json().catch(() => null);
    const parsed = profilePatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const db = getFirestore(getFirebaseAdminApp());
    const docRef = db.collection(COLLECTION_NAME).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 });
    }

    const previous = snapshot.data() ?? {};
    const payload = parsed.data;

    if (!authContext.isSuperAdmin && (await isSuperAdminAddress(previous.email))) {
      return forbiddenSuperAdminTarget();
    }

    /**
     * A permissão de cada pessoa é achada pelo e-mail do cadastro. Dois cadastros
     * com o mesmo e-mail deixariam essa busca ambígua — e duplicariam a pessoa.
     */
    if (payload.email && payload.email !== previous.email) {
      const sameEmail = await db
        .collection(COLLECTION_NAME)
        .where('email', '==', payload.email)
        .limit(1)
        .get();
      if (!sameEmail.empty && sameEmail.docs[0].id !== id) {
        return invalidRequest('Já existe outro colaborador com este e-mail.');
      }
    }

    const changes = Object.entries(payload)
      .filter(([field, value]) => JSON.stringify(previous[field]) !== JSON.stringify(value))
      .map(([field, value]) => ({ field, oldValue: previous[field] ?? null, newValue: value }));

    if (changes.length === 0) {
      return jsonOk({ ok: true, changed: 0 });
    }

    const update = Object.fromEntries(changes.map(({ field, newValue }) => [field, newValue]));

    const batch = db.batch();
    batch.update(docRef, update);
    batch.create(db.collection(LOG_COLLECTION_NAME).doc(), {
      collaboratorId: id,
      collaboratorName: payload.name ?? previous.name ?? '',
      updatedBy: authContext.email ?? 'desconhecido',
      updatedAt: new Date().toISOString(),
      changes,
    });
    await batch.commit();

    logSecurityEvent('[api/admin/collaborators] colaborador editado', {
      email: authContext.email,
      collaboratorId: id,
      fields: changes.map(({ field }) => field).join(','),
    });

    return jsonOk({ ok: true, changed: changes.length });
  } catch (error) {
    return handleError(error, 'PATCH');
  }
}

export async function DELETE(request: Request) {
  try {
    const authContext = await requireCollaboratorAdmin(request.headers.get('Authorization'));

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return invalidRequest('Informe o id do colaborador.');

    const db = getFirestore(getFirebaseAdminApp());
    const docRef = db.collection(COLLECTION_NAME).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 });
    }

    const previous = snapshot.data() ?? {};
    if (!authContext.isSuperAdmin && (await isSuperAdminAddress(previous.email))) {
      return forbiddenSuperAdminTarget();
    }

    const batch = db.batch();
    batch.delete(docRef);
    batch.update(db.collection('systemSettings').doc('config'), {
      collaboratorTableVersion: FieldValue.increment(1),
    });
    await batch.commit();

    logSecurityEvent('[api/admin/collaborators] colaborador excluido', {
      email: authContext.email,
      collaboratorId: id,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

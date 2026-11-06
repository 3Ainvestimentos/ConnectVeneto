import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';
import {
  isBibliotecaComercialManager,
  logSecurityEvent,
  requireBibliotecaComercialManager,
  requireCorporateUser,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  COMMERCIAL_DOCUMENTS_COLLECTION,
  COMMERCIAL_STORAGE_FOLDER,
  MAX_UPLOAD_BYTES,
  canEditCommercialDocument,
} from '@/config/biblioteca-comercial';

const MAX_TAGS = 12;

const httpsUrlSchema = z
  .string()
  .trim()
  .min(1, 'Informe o endereço do documento.')
  .max(2048, 'URL muito longa.')
  .refine((value) => /^https:\/\/[^\s]+$/.test(value), 'O endereço deve ser uma URL https://.');

const baseFieldsSchema = z.object({
  title: z.string().trim().min(3, 'O título precisa de pelo menos 3 caracteres.').max(200),
  description: z
    .string()
    .trim()
    .min(10, 'Descreva o documento com pelo menos 10 caracteres — é o que a busca por IA usa.')
    .max(2000),
  tags: z
    .array(z.string().trim().min(2).max(40))
    .max(MAX_TAGS, `Use no máximo ${MAX_TAGS} tags.`)
    .default([]),
});

/**
 * Upload: o arquivo já está no Storage (o client sobe direto, veja
 * `lib/biblioteca-comercial-storage.ts`) e aqui só registramos o metadado.
 * O `storagePath` é restrito à pasta da biblioteca para o DELETE não conseguir
 * apagar objetos de outras áreas do bucket.
 */
const isLibraryStoragePath = (value: string) =>
  value.startsWith(`${COMMERCIAL_STORAGE_FOLDER}/`) && !value.includes('..');

const uploadedFileSchema = z.object({
  fileType: z.enum(['pdf', 'ppt', 'audio', 'image', 'html']),
  downloadUrl: httpsUrlSchema,
  storagePath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(isLibraryStoragePath, 'Caminho de arquivo inválido.'),
  mimeType: z.enum(ACCEPTED_UPLOAD_MIME_TYPES as [string, ...string[]]),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

const MAX_EDITORS = 20;

/** Quem pode atualizar o documento além dos gestores — só gestor define. */
const editorEmailsSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[^\s@]+@venetomfo\.com\.br$/, 'Editores precisam ter e-mail @venetomfo.com.br.')
  )
  .max(MAX_EDITORS, `Use no máximo ${MAX_EDITORS} editores.`)
  .transform((emails) => [...new Set(emails)]);

const uploadPayloadSchema = baseFieldsSchema.merge(uploadedFileSchema).extend({
  sourceType: z.literal('upload'),
  editorEmails: editorEmailsSchema.optional(),
});

const linkPayloadSchema = baseFieldsSchema.extend({
  sourceType: z.literal('link'),
  fileType: z.enum(['pdf', 'ppt', 'audio', 'image', 'link']),
  downloadUrl: httpsUrlSchema,
  editorEmails: editorEmailsSchema.optional(),
});

const createPayloadSchema = z.discriminatedUnion('sourceType', [
  uploadPayloadSchema,
  linkPayloadSchema,
]);

/**
 * Edição: metadados, nova versão do arquivo (o client já subiu ao Storage; o
 * anterior é apagado aqui) e, só para gestores, a lista de editores.
 */
const updatePayloadSchema = baseFieldsSchema
  .partial()
  .extend({
    file: uploadedFileSchema.optional(),
    editorEmails: editorEmailsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nada para atualizar.');

/** Apaga um objeto da pasta da biblioteca; falhar só deixa um órfão no bucket. */
const deleteLibraryObject = async (storagePath: unknown, documentId: string) => {
  if (typeof storagePath !== 'string' || !isLibraryStoragePath(storagePath)) return;
  // O app Admin é inicializado sem `storageBucket`, então o bucket vai explícito.
  await getStorage(getFirebaseAdminApp())
    .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
    .file(storagePath)
    .delete()
    .catch((error: unknown) => {
      logSecurityEvent('[api/biblioteca-comercial/documents] falha ao remover arquivo', {
        documentId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    });
};

const normalizeTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};

const invalidRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  if (knownSecurityError) {
    logSecurityEvent(`[api/biblioteca-comercial/documents] security error (${action})`, {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return knownSecurityError;
  }

  logSecurityEvent(`[api/biblioteca-comercial/documents] unexpected error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return NextResponse.json(
    { error: 'Falha ao salvar o documento da Biblioteca Comercial.' },
    { status: 500 }
  );
};

/** Cria o metadado de um documento (arquivo já enviado ao Storage, ou link externo). */
export async function POST(request: Request) {
  try {
    const context = await requireBibliotecaComercialManager(request.headers.get('Authorization'));

    const rawBody = await request.json().catch(() => null);
    const parsed = createPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const now = new Date().toISOString();
    const payload = parsed.data;
    const db = getFirestore(getFirebaseAdminApp());

    const docRef = await db.collection(COMMERCIAL_DOCUMENTS_COLLECTION).add({
      title: payload.title,
      description: payload.description,
      tags: normalizeTags(payload.tags),
      sourceType: payload.sourceType,
      fileType: payload.fileType,
      downloadUrl: payload.downloadUrl,
      ...(payload.sourceType === 'upload'
        ? {
            storagePath: payload.storagePath,
            mimeType: payload.mimeType,
            sizeBytes: payload.sizeBytes,
          }
        : {}),
      editorEmails: payload.editorEmails ?? [],
      // Reservado para RAG: nenhum conteúdo de arquivo é indexado nesta versão.
      contentIndexed: false,
      uploadedByUid: context.uid,
      uploadedByName: context.email ?? 'desconhecido',
      createdAt: now,
      updatedAt: now,
    });

    logSecurityEvent('[api/biblioteca-comercial/documents] documento criado', {
      email: context.email,
      documentId: docRef.id,
      sourceType: payload.sourceType,
    });

    return NextResponse.json(
      { ok: true, id: docRef.id },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return handleError(error, 'POST');
  }
}

/**
 * Edita metadados e/ou troca o arquivo. Pode quem é gestor da biblioteca ou está
 * em `editorEmails` do documento; a lista de editores só o gestor altera.
 */
export async function PATCH(request: Request) {
  try {
    const context = await requireCorporateUser(request.headers.get('Authorization'));

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return invalidRequest('Informe o id do documento.');

    const rawBody = await request.json().catch(() => null);
    const parsed = updatePayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const db = getFirestore(getFirebaseAdminApp());
    const docRef = db.collection(COMMERCIAL_DOCUMENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404 });
    }
    const current = snapshot.data() ?? {};

    const isManager = await isBibliotecaComercialManager(context);
    if (!canEditCommercialDocument({ editorEmails: current.editorEmails }, context.email, isManager)) {
      throw new Error('FORBIDDEN_BIBLIOTECA_COMERCIAL_MANAGER_REQUIRED');
    }

    const { title, description, tags, file, editorEmails } = parsed.data;
    if (editorEmails !== undefined && !isManager) {
      return NextResponse.json(
        { error: 'Só gestores da biblioteca definem quem pode editar o documento.' },
        { status: 403 }
      );
    }
    if (file && current.sourceType !== 'upload') {
      return invalidRequest('Só documentos enviados como arquivo podem ter o arquivo substituído.');
    }
    // Trocar PDF por áudio mudaria como o card abre o material: é outro documento.
    if (file && file.fileType !== current.fileType) {
      return invalidRequest('O novo arquivo precisa ser do mesmo tipo do atual.');
    }

    const now = new Date().toISOString();
    await docRef.update({
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
      ...(editorEmails !== undefined ? { editorEmails } : {}),
      ...(file
        ? {
            downloadUrl: file.downloadUrl,
            storagePath: file.storagePath,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            fileUpdatedAt: now,
            fileUpdatedByName: context.email ?? 'desconhecido',
          }
        : {}),
      updatedAt: now,
    });

    if (file && current.storagePath !== file.storagePath) {
      await deleteLibraryObject(current.storagePath, id);
    }

    logSecurityEvent('[api/biblioteca-comercial/documents] documento atualizado', {
      email: context.email,
      documentId: id,
      asEditor: !isManager,
      fileReplaced: !!file,
    });

    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return handleError(error, 'PATCH');
  }
}

/** Exclui o documento e, quando for upload, também o arquivo no Storage. */
export async function DELETE(request: Request) {
  try {
    const context = await requireBibliotecaComercialManager(request.headers.get('Authorization'));

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return invalidRequest('Informe o id do documento.');

    const db = getFirestore(getFirebaseAdminApp());
    const docRef = db.collection(COMMERCIAL_DOCUMENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404 });
    }

    const storagePath = snapshot.data()?.storagePath;
    await docRef.delete();
    await deleteLibraryObject(storagePath, id);

    logSecurityEvent('[api/biblioteca-comercial/documents] documento excluido', {
      email: context.email,
      documentId: id,
    });

    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

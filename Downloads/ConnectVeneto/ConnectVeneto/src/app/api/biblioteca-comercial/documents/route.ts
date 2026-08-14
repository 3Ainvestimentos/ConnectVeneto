import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';
import {
  logSecurityEvent,
  requireBibliotecaComercialManager,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  COMMERCIAL_DOCUMENTS_COLLECTION,
  COMMERCIAL_STORAGE_FOLDER,
  MAX_UPLOAD_BYTES,
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
const uploadPayloadSchema = baseFieldsSchema.extend({
  sourceType: z.literal('upload'),
  fileType: z.enum(['pdf', 'ppt', 'audio']),
  downloadUrl: httpsUrlSchema,
  storagePath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (value) => value.startsWith(`${COMMERCIAL_STORAGE_FOLDER}/`) && !value.includes('..'),
      'Caminho de arquivo inválido.'
    ),
  mimeType: z.enum(ACCEPTED_UPLOAD_MIME_TYPES as [string, ...string[]]),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

const linkPayloadSchema = baseFieldsSchema.extend({
  sourceType: z.literal('link'),
  fileType: z.enum(['pdf', 'ppt', 'audio', 'link']),
  downloadUrl: httpsUrlSchema,
});

const createPayloadSchema = z.discriminatedUnion('sourceType', [
  uploadPayloadSchema,
  linkPayloadSchema,
]);

/** Na edição só os metadados mudam — trocar o arquivo é criar outro documento. */
const updatePayloadSchema = baseFieldsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Nada para atualizar.'
);

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

/** Edita título, descrição e tags. */
export async function PATCH(request: Request) {
  try {
    const context = await requireBibliotecaComercialManager(request.headers.get('Authorization'));

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return invalidRequest('Informe o id do documento.');

    const rawBody = await request.json().catch(() => null);
    const parsed = updatePayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const db = getFirestore(getFirebaseAdminApp());
    const docRef = db.collection(COMMERCIAL_DOCUMENTS_COLLECTION).doc(id);
    if (!(await docRef.get()).exists) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404 });
    }

    const { title, description, tags } = parsed.data;
    await docRef.update({
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
      updatedAt: new Date().toISOString(),
    });

    logSecurityEvent('[api/biblioteca-comercial/documents] documento atualizado', {
      email: context.email,
      documentId: id,
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

    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const docRef = db.collection(COMMERCIAL_DOCUMENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404 });
    }

    const storagePath = snapshot.data()?.storagePath;
    await docRef.delete();

    if (
      typeof storagePath === 'string' &&
      storagePath.startsWith(`${COMMERCIAL_STORAGE_FOLDER}/`) &&
      !storagePath.includes('..')
    ) {
      // O app Admin é inicializado sem `storageBucket`, então o bucket vai explícito.
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      // O metadado já foi removido; falhar aqui só deixa um objeto órfão no bucket.
      await getStorage(app)
        .bucket(bucketName)
        .file(storagePath)
        .delete()
        .catch((error: unknown) => {
          logSecurityEvent('[api/biblioteca-comercial/documents] falha ao remover arquivo', {
            documentId: id,
            error: error instanceof Error ? error.message : 'unknown',
          });
        });
    }

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

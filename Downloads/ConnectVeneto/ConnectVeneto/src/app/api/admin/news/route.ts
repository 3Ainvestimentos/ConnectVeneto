import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';
import {
  logSecurityEvent,
  requireContentManager,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  NEWS_COLLECTION,
  NEWS_STORAGE_FOLDER,
  isNewsStoragePath,
} from '@/config/news-media';

const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL muito longa.')
  .refine((value) => /^https:\/\/[^\s]+$/.test(value), 'O endereço deve ser uma URL https://.');

/**
 * `storagePath` só é aceito dentro da pasta de notícias: é o caminho que o DELETE
 * usa para apagar o arquivo, e ele não pode alcançar outras áreas do bucket.
 */
const storagePathSchema = z
  .string()
  .trim()
  .max(500)
  .refine(isNewsStoragePath, 'Caminho de arquivo inválido.');

const newsFieldsSchema = z.object({
  title: z.string().trim().min(3, 'Título deve ter no mínimo 3 caracteres.').max(300),
  snippet: z.string().trim().min(10, 'Snippet deve ter no mínimo 10 caracteres.').max(1000),
  content: z.string().trim().min(10, 'Conteúdo deve ter no mínimo 10 caracteres.').max(20000),
  category: z.string().trim().min(1, 'Categoria é obrigatória.').max(120),
  date: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida.'),
  imageUrl: httpsUrlSchema,
  imageStoragePath: storagePathSchema.optional().or(z.literal('')),
  videoUrl: httpsUrlSchema.optional().or(z.literal('')),
  videoStoragePath: storagePathSchema.optional().or(z.literal('')),
  link: httpsUrlSchema.optional().or(z.literal('')),
  order: z.number().int().min(0).max(100000).optional(),
  status: z.enum(['draft', 'approved', 'published', 'archived']).optional(),
  isHighlight: z.boolean().optional(),
  highlightType: z.enum(['large', 'small']).optional(),
});

const createPayloadSchema = newsFieldsSchema;

const updatePayloadSchema = newsFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nada para atualizar.');

const invalidRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

const jsonOk = (body: Record<string, unknown>) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  if (knownSecurityError) {
    logSecurityEvent(`[api/admin/news] security error (${action})`, {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return knownSecurityError;
  }

  logSecurityEvent(`[api/admin/news] unexpected error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return NextResponse.json({ error: 'Falha ao salvar a notícia.' }, { status: 500 });
};

/** Remoção best-effort: a notícia já foi gravada, sobrar objeto no bucket é só lixo. */
const deleteStorageObject = async (storagePath: string, context: string): Promise<void> => {
  if (!isNewsStoragePath(storagePath)) return;

  // O app Admin é inicializado sem `storageBucket`, então o bucket vai explícito.
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  await getStorage(getFirebaseAdminApp())
    .bucket(bucketName)
    .file(storagePath)
    .delete()
    .catch((error: unknown) => {
      logSecurityEvent('[api/admin/news] falha ao remover arquivo', {
        context,
        storagePath,
        error: error instanceof Error ? error.message : 'unknown',
      });
    });
};

/** Cria a notícia (arquivos de mídia, quando houver, já foram enviados ao Storage). */
export async function POST(request: Request) {
  try {
    const authContext = await requireContentManager(request.headers.get('Authorization'));

    const rawBody = await request.json().catch(() => null);
    const parsed = createPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const payload = parsed.data;
    const db = getFirestore(getFirebaseAdminApp());
    const collection = db.collection(NEWS_COLLECTION);

    // A ordem é calculada aqui e não no client: o client só enxerga o que já baixou.
    const lastByOrder = await collection.orderBy('order', 'desc').limit(1).get();
    const currentMaxOrder = lastByOrder.empty ? 0 : Number(lastByOrder.docs[0].data()?.order ?? 0);

    const now = new Date().toISOString();
    const docRef = await collection.add({
      ...payload,
      videoUrl: payload.videoUrl ?? '',
      videoStoragePath: payload.videoStoragePath ?? '',
      imageStoragePath: payload.imageStoragePath ?? '',
      link: payload.link ?? '',
      isHighlight: payload.isHighlight ?? false,
      highlightType: payload.highlightType ?? 'small',
      // Notícia nova sempre nasce como rascunho — publicar é um segundo passo.
      status: 'draft',
      order: payload.order ?? currentMaxOrder + 1,
      createdAt: now,
      updatedAt: now,
      updatedByEmail: authContext.email ?? 'desconhecido',
    });

    logSecurityEvent('[api/admin/news] noticia criada', {
      email: authContext.email,
      newsId: docRef.id,
    });

    return jsonOk({ ok: true, id: docRef.id });
  } catch (error) {
    return handleError(error, 'POST');
  }
}

/** Edita a notícia. Trocar a mídia apaga o arquivo anterior, se era upload nosso. */
export async function PATCH(request: Request) {
  try {
    const authContext = await requireContentManager(request.headers.get('Authorization'));

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return invalidRequest('Informe o id da notícia.');

    const rawBody = await request.json().catch(() => null);
    const parsed = updatePayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidRequest(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
    }

    const db = getFirestore(getFirebaseAdminApp());
    const docRef = db.collection(NEWS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Noticia nao encontrada.' }, { status: 404 });
    }

    const previous = snapshot.data() ?? {};
    const payload = parsed.data;

    /**
     * Quem manda a URL da mídia manda junto o storagePath correspondente (ou nada,
     * quando a mídia virou link externo). Sem isso, um upload trocado por link
     * deixaria o arquivo antigo no bucket para sempre.
     */
    const imageTouched = 'imageUrl' in payload;
    const videoTouched = 'videoUrl' in payload;

    await docRef.update({
      ...payload,
      ...(imageTouched ? { imageStoragePath: payload.imageStoragePath ?? '' } : {}),
      ...(videoTouched ? { videoStoragePath: payload.videoStoragePath ?? '' } : {}),
      updatedAt: new Date().toISOString(),
      updatedByEmail: authContext.email ?? 'desconhecido',
    });

    const mediaFields = [
      { field: 'imageStoragePath', touched: imageTouched },
      { field: 'videoStoragePath', touched: videoTouched },
    ] as const;

    for (const { field, touched } of mediaFields) {
      if (!touched) continue;
      const previousPath = previous[field];
      const nextPath = payload[field] ?? '';
      if (typeof previousPath === 'string' && previousPath && previousPath !== nextPath) {
        await deleteStorageObject(previousPath, `PATCH ${id} ${field}`);
      }
    }

    logSecurityEvent('[api/admin/news] noticia atualizada', {
      email: authContext.email,
      newsId: id,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'PATCH');
  }
}

/** Exclui a notícia e os arquivos de mídia que tenham sido enviados por upload. */
export async function DELETE(request: Request) {
  try {
    const authContext = await requireContentManager(request.headers.get('Authorization'));

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return invalidRequest('Informe o id da notícia.');

    const db = getFirestore(getFirebaseAdminApp());
    const docRef = db.collection(NEWS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Noticia nao encontrada.' }, { status: 404 });
    }

    const data = snapshot.data() ?? {};
    await docRef.delete();

    for (const field of ['imageStoragePath', 'videoStoragePath'] as const) {
      const storagePath = data[field];
      if (typeof storagePath === 'string' && storagePath.startsWith(`${NEWS_STORAGE_FOLDER}/`)) {
        await deleteStorageObject(storagePath, `DELETE ${id} ${field}`);
      }
    }

    logSecurityEvent('[api/admin/news] noticia excluida', {
      email: authContext.email,
      newsId: id,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

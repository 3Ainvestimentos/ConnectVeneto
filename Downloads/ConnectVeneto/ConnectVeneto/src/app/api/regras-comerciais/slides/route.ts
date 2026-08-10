import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  logSecurityEvent,
  requireRegrasComerciaisManager,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

const COLLECTION_NAME = 'regrasComerciaisSlides';
const MAX_SLIDES = 40;

/**
 * `src` aceita URL https (upload no Firebase Storage) ou caminho absoluto interno
 * (`/regras-comerciais/mix/03.png`, servido de `public/`). Qualquer outra forma —
 * `javascript:`, `data:`, protocol-relative — é rejeitada.
 */
const slideSrcSchema = z
  .string()
  .trim()
  .min(1, 'Informe a imagem do slide.')
  .max(2048, 'URL da imagem muito longa.')
  .refine(
    (value) => /^https:\/\/[^\s]+$/.test(value) || /^\/[^/\s][^\s]*$/.test(value),
    'A imagem deve ser uma URL https:// ou um caminho interno começando com "/".'
  );

const slidesPayloadSchema = z.object({
  slides: z
    .array(
      z.object({
        src: slideSrcSchema,
        alt: z
          .string()
          .trim()
          .min(3, 'Descreva a imagem (texto alternativo) com pelo menos 3 caracteres.')
          .max(300, 'Texto alternativo muito longo.'),
      })
    )
    .min(1, 'A apresentação precisa de pelo menos um slide.')
    .max(MAX_SLIDES, `A apresentação suporta no máximo ${MAX_SLIDES} slides.`),
});

/**
 * Substitui a lista completa de slides do carrossel "Apresentação — Mix de Serviços".
 *
 * Escrita passa por aqui (Admin SDK) porque as regras do Firestore liberam apenas
 * leitura da coleção: a permissão `canManageRegrasComerciais` mora no documento do
 * colaborador, que as rules não conseguem consultar por e-mail.
 */
export async function PUT(request: Request) {
  try {
    const context = await requireRegrasComerciaisManager(request.headers.get('Authorization'));

    const rawBody = await request.json().catch(() => null);
    const parsed = slidesPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Requisicao invalida.' },
        { status: 400 }
      );
    }

    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const collection = db.collection(COLLECTION_NAME);

    const existing = await collection.get();
    const batch = db.batch();

    for (const doc of existing.docs) {
      batch.delete(doc.ref);
    }

    parsed.data.slides.forEach((slide, index) => {
      batch.set(collection.doc(), {
        src: slide.src,
        alt: slide.alt,
        order: index,
        updatedAt: new Date().toISOString(),
        updatedByUid: context.uid,
        updatedByEmail: context.email,
      });
    });

    await batch.commit();

    logSecurityEvent('[api/regras-comerciais/slides] slides atualizados', {
      email: context.email,
      total: parsed.data.slides.length,
    });

    return NextResponse.json(
      { ok: true, total: parsed.data.slides.length },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/regras-comerciais/slides] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/regras-comerciais/slides] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Falha ao salvar os slides do Mix de Servicos.' },
      { status: 500 }
    );
  }
}

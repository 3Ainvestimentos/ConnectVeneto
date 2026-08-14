import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  canViewInternalDocuments,
  logSecurityEvent,
  requireBibliotecaComercialViewer,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { completeWithJsonSchema } from '@/lib/openai';
import { COMMERCIAL_DOCUMENTS_COLLECTION, type CommercialDocument } from '@/config/biblioteca-comercial';
import { toUnifiedFromCommercial, toUnifiedFromInternal } from '@/lib/document-search';
import { venetoRepositoryDocuments } from '@/config/veneto-documentos';
import { mergeStaticAndFirestoreDocuments } from '@/lib/document-repository-utils';
import type { DocumentType } from '@/contexts/DocumentsContext';

const MAX_RESULTS = 12;

const payloadSchema = z.object({
  query: z.string().trim().min(2, 'Digite ao menos 2 caracteres.').max(300),
});

const responseSchema = {
  type: 'object',
  properties: {
    keys: {
      type: 'array',
      description:
        'Chaves dos documentos relevantes, da maior para a menor aderência ao pedido. Vazio se nada servir.',
      items: { type: 'string' },
    },
  },
  required: ['keys'],
  additionalProperties: false,
} as const;

type SearchModelResponse = { keys: string[] };

type CatalogEntry = {
  key: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  kind: string;
};

const buildSystemPrompt = (catalog: CatalogEntry[]): string =>
  [
    'Você é o buscador da biblioteca de documentos da Vêneto (uma gestora de patrimônio).',
    'Quem pesquisa é um consultor comercial, muitas vezes em reunião com um cliente,',
    'procurando um material específico (lâmina, apresentação, podcast, formulário).',
    '',
    'Receba a descrição do que a pessoa procura e devolva as chaves (`key`) dos documentos',
    `do catálogo abaixo que atendem ao pedido, no máximo ${MAX_RESULTS}, ordenadas da maior`,
    'para a menor aderência. Use apenas chaves que existam no catálogo, copiadas exatamente.',
    '',
    'Considere sinônimos e o jargão do mercado financeiro (lâmina = one pager = ficha do',
    'fundo; institucional = apresentação da casa). Ignore diferenças de acento e de',
    'maiúsculas. Não force resultados: se nenhum documento atender, devolva a lista vazia.',
    'Prefira precisão a volume — três documentos certos valem mais que dez aproximados.',
    '',
    'Catálogo (JSON):',
    JSON.stringify(catalog),
  ].join('\n');

/**
 * Busca por descrição nos dois acervos (comercial e interno).
 *
 * O catálogo de metadados inteiro vai no prompt e o modelo devolve as chaves
 * ordenadas por aderência — sem embeddings nem banco vetorial. O conteúdo dos
 * arquivos não é lido: a qualidade do resultado depende de título, descrição e tags.
 */
export async function POST(request: Request) {
  try {
    const context = await requireBibliotecaComercialViewer(request.headers.get('Authorization'));

    const rawBody = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Requisicao invalida.' },
        { status: 400 }
      );
    }

    const db = getFirestore(getFirebaseAdminApp());

    // Documentos internos têm permissão própria: sem ela, a busca cobre só o comercial.
    const includeInternal = await canViewInternalDocuments(context);

    const [commercialSnapshot, internalSnapshot] = await Promise.all([
      db.collection(COMMERCIAL_DOCUMENTS_COLLECTION).get(),
      includeInternal ? db.collection('documents').get() : Promise.resolve(null),
    ]);

    const commercialDocuments = commercialSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as CommercialDocument
    );

    const internalDocuments = includeInternal
      ? mergeStaticAndFirestoreDocuments(
          (internalSnapshot?.docs ?? []).map((doc) => ({ id: doc.id, ...doc.data() }) as DocumentType),
          venetoRepositoryDocuments
        )
      : [];

    const unified = [
      ...commercialDocuments.map(toUnifiedFromCommercial),
      ...internalDocuments.map(toUnifiedFromInternal),
    ];

    if (unified.length === 0) {
      return NextResponse.json(
        { keys: [] },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const catalog: CatalogEntry[] = unified.map((document) => ({
      key: document.key,
      title: document.title,
      description: document.description,
      tags: document.tags,
      category: document.category ?? '',
      kind: document.kind,
    }));

    const result = await completeWithJsonSchema<SearchModelResponse>({
      systemPrompt: buildSystemPrompt(catalog),
      messages: [{ role: 'user', content: parsed.data.query }],
      schemaName: 'busca_biblioteca_documentos',
      schema: responseSchema,
      maxOutputTokens: 400,
    });

    // O modelo pode devolver uma chave inexistente: só passam as que existem de fato.
    const validKeys = new Set(unified.map((document) => document.key));
    const keys = result.keys.filter((key) => validKeys.has(key)).slice(0, MAX_RESULTS);

    // Mesma coleção e evento da busca do repositório interno, para comparar as duas.
    await db
      .collection('audit_logs')
      .add({
        eventType: 'search_term_used',
        userId: context.uid,
        userName: context.email ?? 'desconhecido',
        timestamp: new Date().toISOString(),
        details: {
          term: parsed.data.query,
          source: 'biblioteca_comercial_ia',
          resultsCount: keys.length,
          hasResults: keys.length > 0,
          catalogSize: catalog.length,
        },
      })
      .catch(() => {
        // Falha de telemetria não pode derrubar a busca do usuário.
      });

    return NextResponse.json({ keys }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/biblioteca-comercial/search] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/biblioteca-comercial/search] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Não foi possível buscar agora. Tente novamente.' },
      { status: 500 }
    );
  }
}

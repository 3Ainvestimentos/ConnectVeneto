import type { DocumentType } from '@/contexts/DocumentsContext';
import {
  favoriteKey,
  type CommercialDocument,
  type DocumentSegment,
} from '@/config/biblioteca-comercial';

/**
 * Representação única dos dois acervos (internos e comerciais) para a busca e para
 * os cards de resultado. O módulo é compartilhado entre client e API route: nada de
 * Firebase aqui dentro.
 */
export type UnifiedDocument = {
  /** `internal:<id>` ou `commercial:<id>` — mesma convenção dos favoritos. */
  key: string;
  segment: DocumentSegment;
  id: string;
  title: string;
  /** Vazia na maioria dos internos, que não têm descrição cadastrada. */
  description: string;
  tags: string[];
  /** Categoria dos internos; os comerciais não têm (a taxonomia deles é só tags). */
  category?: string;
  kind: 'pdf' | 'ppt' | 'audio' | 'doc' | 'sheet' | 'form' | 'page' | 'link';
  downloadUrl: string;
  /** Só em documentos internos que são páginas do próprio app (ex.: glossário). */
  internalPath?: string;
  sourceType: 'upload' | 'link';
  sizeBytes?: number;
  sizeLabel?: string;
  /** ISO de publicação — só nos comerciais; usado para exibir mês/ano no card. */
  createdAt?: string;
};

const INTERNAL_TYPE_TO_KIND: Record<string, UnifiedDocument['kind']> = {
  pdf: 'pdf',
  ppt: 'ppt',
  pptx: 'ppt',
  doc: 'doc',
  docx: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  form: 'form',
  interno: 'page',
  link: 'link',
};

export const toUnifiedFromCommercial = (document: CommercialDocument): UnifiedDocument => ({
  key: favoriteKey('commercial', document.id),
  segment: 'commercial',
  id: document.id,
  title: document.title,
  description: document.description,
  tags: document.tags ?? [],
  kind: document.fileType,
  downloadUrl: document.downloadUrl,
  sourceType: document.sourceType,
  sizeBytes: document.sizeBytes,
  createdAt: document.createdAt,
});

export const toUnifiedFromInternal = (document: DocumentType): UnifiedDocument => ({
  key: favoriteKey('internal', document.id),
  segment: 'internal',
  id: document.id,
  title: document.name,
  // `dataAiHint` existia no modelo sem nenhum consumidor; aqui vira contexto de busca.
  description: document.dataAiHint ?? '',
  tags: [],
  category: document.category,
  kind: INTERNAL_TYPE_TO_KIND[document.type?.toLowerCase()] ?? 'link',
  downloadUrl: document.downloadUrl,
  internalPath: document.internalPath,
  sourceType: 'link',
  sizeLabel: document.size,
});

/** Remove acentos para o filtro local casar "lamina" com "lâmina". */
const DIACRITICS = /[̀-ͯ]/g;

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '');

/**
 * Filtro textual local — resposta imediata enquanto a busca por IA não volta, e
 * também o fallback quando ela falha. Todos os termos precisam aparecer em algum
 * campo (busca conjuntiva), para "book cultura" achar "Book de Cultura".
 */
export const filterDocumentsLocally = (
  documents: UnifiedDocument[],
  query: string
): UnifiedDocument[] => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return documents;

  return documents.filter((document) => {
    const haystack = normalize(
      [document.title, document.description, document.category ?? '', ...document.tags].join(' ')
    );
    return terms.every((term) => haystack.includes(term));
  });
};

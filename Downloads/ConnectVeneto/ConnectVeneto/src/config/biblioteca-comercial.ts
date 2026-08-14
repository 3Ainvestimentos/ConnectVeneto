/**
 * Biblioteca Comercial — acervo de materiais para o time comercial usar em reunião
 * com cliente (aba "Comercial" em /documents).
 *
 * Este módulo é compartilhado entre client e API routes: mantenha-o sem imports de
 * Firebase para poder ser usado nos dois lados.
 */

export const COMMERCIAL_DOCUMENTS_COLLECTION = 'commercialDocuments';
export const DOCUMENT_FAVORITES_COLLECTION = 'documentFavorites';

/** Pasta raiz no Firebase Storage — precisa casar com o bloco em `storage.rules`. */
export const COMMERCIAL_STORAGE_FOLDER = 'biblioteca-comercial';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export type CommercialFileType = 'pdf' | 'ppt' | 'audio' | 'link';

/**
 * MIME types aceitos no upload, mapeados para o tipo exibido na interface.
 * A mesma lista está espelhada em `storage.rules` — alterar aqui exige alterar lá.
 */
export const UPLOAD_MIME_TO_FILE_TYPE: Record<string, Exclude<CommercialFileType, 'link'>> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'audio/m4a': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
};

export const ACCEPTED_UPLOAD_MIME_TYPES = Object.keys(UPLOAD_MIME_TO_FILE_TYPE);

/**
 * Alguns navegadores entregam `File.type` vazio (comum em .m4a e .ppt no Windows).
 * Como as Storage rules validam o contentType, inferimos pela extensão nesses casos.
 */
export const EXTENSION_TO_UPLOAD_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
};

/** MIME efetivo de um upload: o do arquivo quando reconhecido, senão o da extensão. */
export const resolveUploadMime = (fileName: string, fileType: string): string | null => {
  if (fileType && fileType in UPLOAD_MIME_TO_FILE_TYPE) return fileType;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_UPLOAD_MIME[extension] ?? null;
};

/** Valor do atributo `accept` do input de arquivo. */
export const UPLOAD_ACCEPT_ATTRIBUTE = '.pdf,.ppt,.pptx,.mp3,.m4a,.wav';

export const COMMERCIAL_FILE_TYPE_LABEL: Record<CommercialFileType, string> = {
  pdf: 'PDF',
  ppt: 'Apresentação',
  audio: 'Áudio',
  link: 'Link',
};

export interface CommercialDocument {
  id: string;
  title: string;
  /** Descrição rica — é o principal insumo da busca por IA. */
  description: string;
  tags: string[];
  sourceType: 'upload' | 'link';
  fileType: CommercialFileType;
  /** URL com token do Storage (uploads) ou link https externo (Drive). */
  downloadUrl: string;
  /** Só em uploads. Necessário para excluir o objeto e para indexação futura. */
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  /** Reservado para RAG: vira true quando o conteúdo do arquivo for indexado. */
  contentIndexed: boolean;
  uploadedByUid: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Os favoritos são de toda a biblioteca, então o id guardado é prefixado pela
 * segmentação de origem — os ids das duas coleções são independentes e podem colidir.
 */
export type DocumentSegment = 'internal' | 'commercial';

export const favoriteKey = (segment: DocumentSegment, documentId: string): string =>
  `${segment}:${documentId}`;

export interface DocumentFavorites {
  favoriteIds: string[];
  updatedAt: string;
}

export const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
};

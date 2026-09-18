/**
 * Mídia das notícias (aba "Notícias" em /admin/content).
 *
 * Imagens e vídeos podem ser enviados direto do browser para o Firebase Storage,
 * sem depender de um link externo. Mesmo trade-off da Biblioteca Comercial: o
 * upload não passa por API route por causa do limite de corpo de requisição da
 * Vercel (~4,5 MB), e a permissão real é verificada quando o metadado é gravado
 * em /api/admin/news.
 *
 * Este módulo é compartilhado entre client e API routes: mantenha-o sem imports
 * de Firebase para poder ser usado nos dois lados.
 */

export const NEWS_COLLECTION = 'newsItems';

/** Pasta raiz no Firebase Storage — precisa casar com o bloco em `storage.rules`. */
export const NEWS_STORAGE_FOLDER = 'noticias';

export const MAX_NEWS_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_NEWS_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB

export type NewsMediaKind = 'image' | 'video';

/**
 * MIME types aceitos por tipo de mídia. A mesma lista está espelhada em
 * `storage.rules` — alterar aqui exige alterar lá.
 */
export const NEWS_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export const NEWS_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const NEWS_MEDIA_MIME_TYPES: string[] = [
  ...NEWS_IMAGE_MIME_TYPES,
  ...NEWS_VIDEO_MIME_TYPES,
];

/**
 * Alguns navegadores entregam `File.type` vazio (comum em .mov e .webm no Windows).
 * Como as Storage rules validam o contentType, inferimos pela extensão nesses casos.
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

/** MIME efetivo de um upload: o do arquivo quando reconhecido, senão o da extensão. */
export const resolveNewsMediaMime = (fileName: string, fileType: string): string | null => {
  if (fileType && NEWS_MEDIA_MIME_TYPES.includes(fileType)) return fileType;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_MIME[extension] ?? null;
};

export const newsMediaKindOf = (mimeType: string): NewsMediaKind | null => {
  if ((NEWS_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'image';
  if ((NEWS_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return 'video';
  return null;
};

export const maxBytesFor = (kind: NewsMediaKind): number =>
  kind === 'image' ? MAX_NEWS_IMAGE_BYTES : MAX_NEWS_VIDEO_BYTES;

/** Valor do atributo `accept` do input de arquivo. */
export const NEWS_IMAGE_ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,.gif';
export const NEWS_VIDEO_ACCEPT_ATTRIBUTE = '.mp4,.webm,.mov';

/** `storagePath` só é aceito pela API se apontar para dentro da pasta de notícias. */
export const isNewsStoragePath = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.startsWith(`${NEWS_STORAGE_FOLDER}/`) &&
  !value.includes('..');

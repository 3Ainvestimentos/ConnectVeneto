import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { getFirebaseApp } from './firebase';
import {
  NEWS_STORAGE_FOLDER,
  maxBytesFor,
  newsMediaKindOf,
  resolveNewsMediaMime,
  type NewsMediaKind,
} from '@/config/news-media';

export type NewsMediaUploadResult = {
  downloadUrl: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  kind: NewsMediaKind;
};

const formatMb = (bytes: number) => `${Math.floor(bytes / (1024 * 1024))} MB`;

const UNSUPPORTED_IMAGE = 'Formato não suportado. Envie PNG, JPG, WEBP ou GIF.';
const UNSUPPORTED_VIDEO = 'Formato não suportado. Envie MP4, WEBM ou MOV.';

/**
 * Valida o arquivo antes de subir. As Storage rules aplicam os mesmos limites — esta
 * checagem existe para dar erro legível em vez de um `storage/unauthorized` opaco.
 * @returns mensagem de erro, ou null quando o arquivo é aceito.
 */
export const validateNewsMediaFile = (file: File, expected: NewsMediaKind): string | null => {
  const mimeType = resolveNewsMediaMime(file.name, file.type);
  const kind = mimeType ? newsMediaKindOf(mimeType) : null;

  if (!mimeType || kind !== expected) {
    return expected === 'image' ? UNSUPPORTED_IMAGE : UNSUPPORTED_VIDEO;
  }

  const limit = maxBytesFor(kind);
  if (file.size > limit) {
    return `Arquivo muito grande. O limite para ${kind === 'image' ? 'imagens' : 'vídeos'} é ${formatMb(limit)}.`;
  }

  return null;
};

/**
 * Sobe a mídia direto do browser para o Firebase Storage.
 *
 * O upload não passa por API route de propósito: o limite de corpo de requisição da
 * Vercel (~4,5 MB) não acomoda vídeos. A permissão de gestão é verificada quando o
 * metadado da notícia é gravado em /api/admin/news; um upload sem notícia
 * correspondente fica órfão e não aparece em lugar nenhum.
 */
export const uploadNewsMediaFile = (
  file: File,
  expected: NewsMediaKind,
  onProgress?: (percent: number) => void
): Promise<NewsMediaUploadResult> => {
  return new Promise((resolve, reject) => {
    const validationError = validateNewsMediaFile(file, expected);
    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    // `validateNewsMediaFile` já garantiu que os dois resolvem.
    const mimeType = resolveNewsMediaMime(file.name, file.type) as string;
    const kind = newsMediaKindOf(mimeType) as NewsMediaKind;

    const safeFileName = file.name.replace(/[/\\]/g, '_').replace(/\.\./g, '__');
    const storagePath = `${NEWS_STORAGE_FOLDER}/${kind}/${Date.now()}-${safeFileName}`;
    const storageRef = ref(getStorage(getFirebaseApp()), storagePath);

    // contentType explícito: as rules validam esse campo e o File pode chegar sem type.
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: mimeType });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (!onProgress || snapshot.totalBytes === 0) return;
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      (error) => {
        console.error('[noticias] upload error:', error);
        reject(new Error(`Falha no upload: ${error.code}`));
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then((downloadUrl) => {
            resolve({ downloadUrl, storagePath, mimeType, sizeBytes: file.size, kind });
          })
          .catch((error) => reject(new Error(`Falha ao obter URL do arquivo: ${error.code}`)));
      }
    );
  });
};

/** Remove um objeto órfão do Storage (upload concluído, notícia não salva). */
export const deleteNewsMediaFile = async (storagePath: string): Promise<void> => {
  try {
    await deleteObject(ref(getStorage(getFirebaseApp()), storagePath));
  } catch (error) {
    // Best-effort: o objeto órfão não aparece em lugar nenhum de qualquer forma.
    console.warn('[noticias] falha ao remover arquivo órfão:', storagePath, error);
  }
};

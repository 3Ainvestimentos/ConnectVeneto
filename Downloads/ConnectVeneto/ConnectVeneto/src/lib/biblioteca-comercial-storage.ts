import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { getFirebaseApp } from './firebase';
import {
  COMMERCIAL_STORAGE_FOLDER,
  MAX_UPLOAD_BYTES,
  UPLOAD_MIME_TO_FILE_TYPE,
  resolveUploadMime,
  type CommercialFileType,
} from '@/config/biblioteca-comercial';

export type CommercialUploadResult = {
  downloadUrl: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  fileType: Exclude<CommercialFileType, 'link'>;
};

/**
 * Valida o arquivo antes de subir. As Storage rules aplicam os mesmos limites — esta
 * checagem existe para dar erro legível em vez de um `storage/unauthorized` opaco.
 * @returns mensagem de erro, ou null quando o arquivo é aceito.
 */
export const validateCommercialFile = (file: File): string | null => {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Arquivo muito grande. O limite é ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`;
  }
  if (!resolveUploadMime(file.name, file.type)) {
    return 'Formato não suportado. Envie PDF, PPT/PPTX, MP3, M4A ou WAV.';
  }
  return null;
};

/**
 * Sobe o arquivo direto do browser para o Firebase Storage.
 *
 * O upload não passa por API route de propósito: o limite de corpo de requisição da
 * Vercel (~4,5 MB) não acomoda arquivos de até 100 MB. A permissão de gestão é
 * verificada quando o metadado é criado em `POST /api/biblioteca-comercial/documents`;
 * um upload sem esse metadado fica órfão e não aparece na biblioteca.
 */
export const uploadCommercialFile = (
  file: File,
  onProgress?: (percent: number) => void
): Promise<CommercialUploadResult> => {
  return new Promise((resolve, reject) => {
    const mimeType = resolveUploadMime(file.name, file.type);
    if (!mimeType) {
      reject(new Error('Formato não suportado. Envie PDF, PPT/PPTX, MP3, M4A ou WAV.'));
      return;
    }

    const safeFileName = file.name.replace(/[/\\]/g, '_').replace(/\.\./g, '__');
    const storagePath = `${COMMERCIAL_STORAGE_FOLDER}/${Date.now()}-${safeFileName}`;
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
        console.error('[biblioteca-comercial] upload error:', error);
        reject(new Error(`Falha no upload: ${error.code}`));
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then((downloadUrl) => {
            resolve({
              downloadUrl,
              storagePath,
              mimeType,
              sizeBytes: file.size,
              fileType: UPLOAD_MIME_TO_FILE_TYPE[mimeType],
            });
          })
          .catch((error) => reject(new Error(`Falha ao obter URL do arquivo: ${error.code}`)));
      }
    );
  });
};

/** Remove um objeto órfão do Storage (upload concluído, metadado não criado). */
export const deleteCommercialFile = async (storagePath: string): Promise<void> => {
  try {
    await deleteObject(ref(getStorage(getFirebaseApp()), storagePath));
  } catch (error) {
    // Best-effort: o objeto órfão não aparece na biblioteca de qualquer forma.
    console.warn('[biblioteca-comercial] falha ao remover arquivo órfão:', storagePath, error);
  }
};

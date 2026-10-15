"use client";

/**
 * Upload de mídia e anexos das publicações direto do browser para o Storage (`publicacoes/`).
 * Não passa por API route: o limite de corpo da Vercel (~4,5 MB) não comporta vídeo. Quem pode
 * publicar é verificado quando a publicação é gravada em /api/feed/posts; upload sem publicação
 * fica órfão. As Storage rules aplicam os mesmos tipos e limites daqui.
 */
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { getFirebaseApp } from '@/lib/firebase';
import { HUB_STORAGE_FOLDER } from './model';

export type UploadKind = 'image' | 'video' | 'file';

const MB = 1024 * 1024;
export const UPLOAD_LIMITS: Record<UploadKind, number> = { image: 15 * MB, video: 300 * MB, file: 25 * MB };

const ACCEPT: Record<UploadKind, RegExp> = {
  image: /^image\/(png|jpeg|webp|gif)$/,
  video: /^video\/(mp4|webm|quicktime)$/,
  // PDF, Office, texto e planilhas.
  file: /^(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel|vnd\.ms-powerpoint|zip)|text\/(plain|csv))$/,
};

export const ACCEPT_ATTR: Record<UploadKind, string> = {
  image: 'image/png,image/jpeg,image/webp,image/gif',
  video: 'video/mp4,video/webm,video/quicktime',
  file: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip',
};

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  mov: 'video/quicktime',
};

/** Alguns browsers mandam `type` vazio (ex.: .docx no Windows); cai para a extensão. */
function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? '';
}

export function validateUpload(file: File, kind: UploadKind): string | null {
  if (!ACCEPT[kind].test(mimeOf(file))) {
    return kind === 'image' ? 'Envie PNG, JPG, WEBP ou GIF.' : kind === 'video' ? 'Envie MP4, WEBM ou MOV.' : 'Envie PDF, Word, Excel, PowerPoint, TXT, CSV ou ZIP.';
  }
  if (file.size > UPLOAD_LIMITS[kind]) return `Arquivo muito grande: o limite é ${UPLOAD_LIMITS[kind] / MB} MB.`;
  return null;
}

export interface UploadResult {
  url: string;
  storagePath: string;
  name: string;
  size: number;
}

export function uploadHubFile(file: File, kind: UploadKind, uid: string, onProgress?: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const error = validateUpload(file, kind);
    if (error) return reject(new Error(`${file.name}: ${error}`));
    const safe = file.name.replace(/[/\\]/g, '_').replace(/\.\./g, '__');
    const storagePath = `${HUB_STORAGE_FOLDER}/${uid}/${Date.now()}-${safe}`;
    const task = uploadBytesResumable(ref(getStorage(getFirebaseApp()), storagePath), file, { contentType: mimeOf(file) });
    task.on(
      'state_changed',
      (s) => onProgress && s.totalBytes > 0 && onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      (e) => reject(new Error(`${file.name}: não foi possível enviar (${e.code}).`)),
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), storagePath, name: file.name, size: file.size }),
    );
  });
}

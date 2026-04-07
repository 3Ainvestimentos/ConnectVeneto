import type { DocumentType } from "@/contexts/DocumentsContext";

/** Rotas internas permitidas ao abrir a partir da tabela de documentos (evita open redirect). */
const ALLOWED_INTERNAL_PATHS = new Set<string>(["/documents/glossario"]);

export function isAllowedDocumentInternalPath(path: string | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.includes("//")) return false;
  return ALLOWED_INTERNAL_PATHS.has(path);
}

/** Alinhado às regras Firestore: apenas HTTPS, sem espaços. */
export function isSafeRepositoryDownloadUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !/\s/.test(url);
  } catch {
    return false;
  }
}

/** ISO usado só para ordenação: documentos curados ficam no topo em "Modificado" descendente. Não é data real de alteração. */
export const VENETO_REPOSITORY_SORT_SENTINEL_ISO = "2099-01-15T12:00:00.000Z";

export function parseLastModifiedSortValue(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Exibe data amigável; oculta o sentinela de ordenação (evita mostrar 2099 ao utilizador). */
export function formatRepositoryLastModifiedForDisplay(iso: string): string {
  if (!iso || iso === VENETO_REPOSITORY_SORT_SENTINEL_ISO) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("pt-BR");
}

function isPlaceholderSize(size: string | undefined): boolean {
  const t = size?.trim() ?? "";
  return t === "" || t === "—" || t === "-" || t === "–";
}

/**
 * Coluna Tamanho: se houver valor real (ex. upload no admin), mostra-o.
 * Caso contrário, infere um rótulo a partir do tipo e do URL (links externos não têm bytes no config).
 */
export function formatRepositorySizeForDisplay(doc: {
  size: string;
  type: string;
  downloadUrl?: string;
}): string {
  if (!isPlaceholderSize(doc.size)) return doc.size;

  const url = doc.downloadUrl ?? "";
  const type = doc.type.toLowerCase();

  if (type === "interno") return "Página interna";
  if (type === "form") return "Formulário online";
  if (type === "pdf") return "PDF";
  if (type === "link") {
    if (url.includes("/folders/")) return "Pasta (Drive)";
    if (url.includes("/file/d/") || url.includes("drive.google.com/file")) return "Ficheiro (Drive)";
    return "Link";
  }

  return "—";
}

/**
 * Une o catálogo estático (código) com a coleção Firestore.
 * Em caso de mesmo `id`, prevalece o documento do Firestore (edições via admin).
 */
export function mergeStaticAndFirestoreDocuments(
  firestoreDocs: DocumentType[],
  staticDocs: DocumentType[]
): DocumentType[] {
  const byId = new Map<string, DocumentType>();
  for (const d of staticDocs) {
    byId.set(d.id, d);
  }
  for (const d of firestoreDocs) {
    byId.set(d.id, d);
  }
  return Array.from(byId.values());
}

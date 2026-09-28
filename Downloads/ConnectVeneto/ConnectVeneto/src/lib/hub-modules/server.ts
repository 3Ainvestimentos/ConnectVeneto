import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  HUB_MODULES_COLLECTION,
  getFallbackHubModule,
  hubModuleSchema,
  type HubModule,
} from '@/config/modules';

/**
 * Leitura server-side de `hubModules` (Admin SDK), com cache curto em memória.
 * Uma edição feita na aba "Módulos" chega ao token route em até TTL_MS.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: HubModule | null }>();

export function __resetHubModuleCache() {
  cache.clear();
}

/**
 * - documento existe e é válido → ele;
 * - documento não existe → módulo do seed (o banco ainda não foi semeado);
 * - documento existe mas é inválido → null (erro de cadastro precisa aparecer, não ser mascarado);
 * - Firestore fora do ar → seed.
 */
export async function getHubModuleServer(id: string): Promise<HubModule | null> {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  let value: HubModule | null;
  try {
    const snap = await getFirestore(getFirebaseAdminApp())
      .collection(HUB_MODULES_COLLECTION)
      .doc(id)
      .get();

    if (!snap.exists) {
      value = getFallbackHubModule(id) ?? null;
    } else {
      const parsed = hubModuleSchema.safeParse({ ...snap.data(), id });
      if (parsed.success) {
        value = parsed.data;
      } else {
        console.error(`[hubModules] documento inválido: ${id}`, parsed.error.issues[0]);
        value = null;
      }
    }
  } catch (error) {
    console.error(`[hubModules] falha ao ler ${id}; usando seed`, error);
    return getFallbackHubModule(id) ?? null;
  }

  cache.set(id, { at: Date.now(), value });
  return value;
}

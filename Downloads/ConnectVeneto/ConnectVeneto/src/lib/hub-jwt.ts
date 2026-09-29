/**
 * Segredo e verificação dos JWTs trocados entre o hub e os módulos (HS256, HUB_JWT_SECRET).
 * Ref: CONNECTVENETO_MODULE_PROTOCOL.md
 */
import { jwtVerify } from 'jose';

export const HUB_AUDIENCE = 'connect-veneto';

export function getHubJwtSecret() {
  const raw = process.env.HUB_JWT_SECRET?.trim().replace(/^["']|["']$/g, '');
  if (!raw) throw new Error('HUB_JWT_SECRET ausente');
  return new TextEncoder().encode(raw);
}

/**
 * Verifica um JWT server-to-server emitido por um módulo (issuer=moduleId,
 * audience='connect-veneto'). Retorna o moduleId (issuer) ou null.
 * Com `expectedModuleId`, exige que o issuer seja exatamente ele.
 */
export async function verifyModuleRequest(
  request: Request,
  expectedModuleId?: string,
): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), getHubJwtSecret(), {
      audience: HUB_AUDIENCE,
      ...(expectedModuleId ? { issuer: expectedModuleId } : {}),
    });
    return typeof payload.iss === 'string' && payload.iss ? payload.iss : null;
  } catch {
    return null;
  }
}

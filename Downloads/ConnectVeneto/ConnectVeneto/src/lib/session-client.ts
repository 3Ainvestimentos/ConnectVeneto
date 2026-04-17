import type { User } from 'firebase/auth';

export type ClientSessionInfo = {
  uid: string;
  email: string | null;
  isSuperAdmin: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedUserIds: string[];
};

/**
 * Consulta o endpoint `/api/me/session` para obter a decisao de `isSuperAdmin`
 * e o estado de manutencao computados server-side via Firebase Admin SDK.
 *
 * Intencao: remover a dependencia do client ler `systemSettings.config.superAdminEmails`
 * diretamente. Enquanto a migracao do Bloco 7 Phase B nao acontece, esta funcao
 * convive com `fetchPrivateSystemSettings` via fallback.
 *
 * Retorna `null` se a sessao nao puder ser resolvida (usuario sem token, erro de rede,
 * endpoint indisponivel). Nunca lanca: quem chamar decide o fallback.
 */
export async function fetchClientSessionInfo(user: User | null): Promise<ClientSessionInfo | null> {
  if (!user) return null;

  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/me/session', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!response.ok) return null;
    const data = (await response.json()) as ClientSessionInfo;
    return data;
  } catch {
    return null;
  }
}

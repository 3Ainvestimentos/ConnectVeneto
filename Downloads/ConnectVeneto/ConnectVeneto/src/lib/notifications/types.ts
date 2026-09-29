/**
 * Central de Notificações — modelo compartilhado entre client e server.
 *
 * Coleção `notifications`: um documento por destinatário. Somente leitura para o
 * usuário (rules); toda criação/resolução passa pelo Admin SDK
 * (src/lib/notifications/server.ts), chamada pelos módulos via /api/hub/notifications.
 */
export const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * - on_open:    vira lida quando o usuário abre o sino (padrão);
 * - on_resolve: só o emissor marca como lida, quando a pendência é executada
 *               (ex.: solicitação do TrackFlow respondida/cancelada).
 */
export type NotificationReadPolicy = 'on_open' | 'on_resolve';

export type NotificationLink = {
  /** Módulo embarcado onde o caminho abre (iframe). Ausente = rota do próprio hub. */
  moduleId?: string;
  /** Caminho relativo (começa com "/"). */
  path: string;
};

export type HubNotification = {
  id: string;
  recipientEmail: string;
  /** 'connect' para o próprio hub, ou o id do módulo emissor. */
  source: string;
  title: string;
  body?: string | null;
  link?: NotificationLink | null;
  externalRef?: string | null;
  readPolicy: NotificationReadPolicy;
  read: boolean;
  /** Epoch ms (convertido do Timestamp do Firestore). */
  createdAt: number;
  readAt?: number | null;
  resolvedAt?: number | null;
};

/** Caminho relativo seguro: começa com "/" mas não com "//" nem "/\". */
export function isSafeRelativePath(path: unknown): path is string {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) && path.length <= 1000;
}

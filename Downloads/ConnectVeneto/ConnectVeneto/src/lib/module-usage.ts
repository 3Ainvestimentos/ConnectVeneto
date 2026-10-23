import type { HubModule } from '@/config/modules';
import { isModuleActive } from '@/components/layout/navigation';
import { normalizeLoggedPagePath } from '@/config/app-page-routes';

/**
 * Tempo ativo de cada pessoa em cada módulo do Connect.
 *
 * Um doc por pessoa por dia, `{yyyy-mm-dd}_{uid}`, com o acumulado por módulo
 * somado via increment(). Agregar no próprio doc (em vez de um evento por sessão em
 * `audit_logs`) mantém a leitura do relatório em pessoas × dias, não em eventos.
 */
export const MODULE_USAGE_COLLECTION = 'moduleUsage';

export type ModuleUsageEntry = {
  label: string;
  /** Segundos com a aba visível e a pessoa em atividade (veja useModuleTimeTracking). */
  seconds: number;
  /** Quantas vezes a pessoa entrou no módulo vindo de outro (ou abrindo o app nele). */
  visits: number;
};

export type ModuleUsageDay = {
  uid: string;
  userId: string;
  userName: string;
  email: string;
  /** yyyy-mm-dd no fuso de São Paulo. */
  date: string;
  modules: Record<string, ModuleUsageEntry>;
  updatedAt: string;
};

export type ResolvedModule = { id: string; label: string };

/** Data do dia em São Paulo, no formato da chave do doc. */
export const usageDateKey = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/**
 * Módulo do menu a que a rota pertence — o de `href` mais específico, para
 * `/admin/content` não cair num item `/admin` se os dois existirem. Rotas sem item
 * no menu (ex.: /audit, /me/tasks) contam pelo primeiro segmento.
 */
export function resolveModuleForPath(pathname: string, modules: HubModule[]): ResolvedModule {
  const path = normalizeLoggedPagePath(pathname);

  const match = modules
    .filter((mod) => isModuleActive(mod, path))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (match) return { id: match.id, label: match.label };

  const segment = path.split('/').filter(Boolean)[0] ?? 'inicio';
  return { id: `rota-${segment.replace(/[^a-zA-Z0-9_-]/g, '_')}`, label: `/${segment}` };
}

/** "1h 05min", "12min", "40s". */
export const formatDuration = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  if (minutes > 0) return `${minutes}min`;
  return `${seconds}s`;
};

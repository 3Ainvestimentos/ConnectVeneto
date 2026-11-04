/**
 * Fluxos do TrackFlow na página Solicitações (/applications).
 *
 * O TrackFlow devolve, por pessoa, os fluxos que ela pode abrir (`/api/modules/trackflow/fluxos`).
 * Cada fluxo vira um cartão que abre o formulário de abertura dentro do Connect, pelo deep link do
 * módulo embarcado (`/trackflow?to=<path>`). Os cartões entram na área de mesmo nome da lista
 * configurada (comparando sem acento e sem caixa); se não houver, nasce uma área `trackflow-<areaId>`.
 *
 * Funções puras, sem dependência de servidor: o resultado é só para exibição e nunca é salvo na
 * configuração de Admin › Conteúdo.
 */
import type {
  SolicitationArea,
  SolicitationItemExternal,
} from '@/config/veneto-solicitacoes';
import { isSafeRelativePath } from '@/lib/notifications/types';

export type TrackflowFluxo = {
  id: string;
  sigla: string;
  nome: string;
  descricao: string | null;
  areaId: string;
  areaNome: string;
  path: string;
};

/** Ícone (nome do `iconMap` de `@/lib/icons`) das áreas criadas a partir de fluxos. */
export const TRACKFLOW_AREA_ICON = 'Laptop';

export const TRACKFLOW_DEFAULT_SUBTITLE = 'Pedido com acompanhamento no TrackFlow';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Valida a resposta do TrackFlow; descarta entradas incompletas ou com caminho inseguro. */
export function parseTrackflowFluxos(payload: unknown): TrackflowFluxo[] {
  const list = (payload as { fluxos?: unknown } | null)?.fluxos;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const result: TrackflowFluxo[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as Record<string, unknown>;
    if (
      !isNonEmptyString(f.id) ||
      !isNonEmptyString(f.sigla) ||
      !isNonEmptyString(f.nome) ||
      !isNonEmptyString(f.areaId) ||
      !isNonEmptyString(f.areaNome) ||
      !isSafeRelativePath(f.path)
    ) {
      continue;
    }
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    result.push({
      id: f.id,
      sigla: f.sigla,
      nome: f.nome,
      descricao: isNonEmptyString(f.descricao) ? f.descricao : null,
      areaId: f.areaId,
      areaNome: f.areaNome,
      path: f.path,
    });
  }
  return result;
}

/** Título comparável: sem acento, sem caixa, espaços colapsados. */
export function normalizeAreaTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function fluxoToSolicitationItem(fluxo: TrackflowFluxo): SolicitationItemExternal {
  return {
    kind: 'external',
    title: fluxo.nome,
    subtitle: fluxo.descricao ?? TRACKFLOW_DEFAULT_SUBTITLE,
    href: `/trackflow?to=${encodeURIComponent(fluxo.path)}`,
    // Link interno (módulo embarcado): abre na mesma aba.
    newTab: false,
    trackingKey: `trackflow_${fluxo.sigla}`,
  };
}

/**
 * Junta os cartões dos fluxos às áreas configuradas, sem alterar a lista recebida.
 * Sem fluxos, devolve a própria lista (mesma referência). Áreas novas vão para o fim,
 * na ordem em que aparecem na resposta. Um fluxo cujo `trackingKey` já existe na área
 * (cadastrado à mão em Admin › Conteúdo) não é duplicado.
 */
export function mergeFluxosIntoAreas(
  areas: SolicitationArea[],
  fluxos: TrackflowFluxo[],
): SolicitationArea[] {
  if (fluxos.length === 0) return areas;

  const merged = areas.map((area) => ({ ...area, items: [...area.items] }));
  const byTitle = new Map<string, SolicitationArea>();
  for (const area of merged) {
    const key = normalizeAreaTitle(area.title);
    if (!byTitle.has(key)) byTitle.set(key, area);
  }

  for (const fluxo of fluxos) {
    const key = normalizeAreaTitle(fluxo.areaNome);
    let area = byTitle.get(key);
    if (!area) {
      area = {
        id: `trackflow-${fluxo.areaId}`,
        title: fluxo.areaNome,
        icon: TRACKFLOW_AREA_ICON,
        trackingKey: `area_trackflow_${fluxo.areaId}`,
        items: [],
      };
      merged.push(area);
      byTitle.set(key, area);
    }
    const item = fluxoToSolicitationItem(fluxo);
    if (area.items.some((existing) => existing.trackingKey === item.trackingKey)) continue;
    area.items.push(item);
  }

  return merged;
}

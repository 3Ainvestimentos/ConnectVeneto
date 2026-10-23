/**
 * "Erros e sugestões" do Connect, no mesmo padrão dos módulos (Dados Estratégicos,
 * `BotaoErrosESugestoes`): a pessoa reporta um erro ou manda uma sugestão pelo botão do menu e
 * acompanha o status e a resposta. A tela aberta vai junto. Super admin vê todas e responde.
 *
 * ARQUIVO PURO (client-safe): tipos, rótulos e a regra do selo. Leitura e escrita em
 * /api/feedback (coleção `connectFeedback`, só Admin SDK).
 */

export const FEEDBACK_COLLECTION = 'connectFeedback';

export const FEEDBACK_STATUS = ['aberto', 'em_analise', 'resolvido', 'descartado'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUS)[number];

export const FEEDBACK_TYPES = ['erro', 'sugestao'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

// Mesmos rótulos dos módulos: quem mandou quer saber "em que pé está", não o jargão da triagem.
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  aberto: 'Recebida',
  em_analise: 'Em análise',
  resolvido: 'Concluída',
  descartado: 'Encerrada',
};

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = { erro: 'Erro', sugestao: 'Sugestão' };

export const FEEDBACK_MAX_LENGTH = 2000;

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  description: string;
  /** Tela em que a pessoa estava (pathname). */
  page: string | null;
  status: FeedbackStatus;
  /** O que foi feito, escrito pela triagem (null enquanto não houver resposta). */
  response: string | null;
  createdAt: string;
  /** Última mudança de status ou resposta pela triagem. */
  updatedAt: string | null;
  /** Só na visão de super admin (todas): quem enviou. */
  authorEmail?: string;
  authorName?: string;
}

export interface FeedbackListResponse {
  items: FeedbackItem[];
  /** true = visão de super admin (todas as pessoas). */
  all: boolean;
}

export const isOpenStatus = (s: FeedbackStatus) => s === 'aberto' || s === 'em_analise';

/** Status visto por id, guardado no navegador (só para o selo). */
export type SeenStatus = Record<string, FeedbackStatus>;

export const currentStatuses = (items: Pick<FeedbackItem, 'id' | 'status'>[]): SeenStatus =>
  Object.fromEntries(items.map((i) => [i.id, i.status]));

/** Ids cujo status mudou desde a última vez que a pessoa abriu a lista (item novo não acende). */
export function changedSince(items: Pick<FeedbackItem, 'id' | 'status'>[], seen: SeenStatus): string[] {
  return items.filter((i) => seen[i.id] !== undefined && seen[i.id] !== i.status).map((i) => i.id);
}

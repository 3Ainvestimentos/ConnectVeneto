import { hubRoute, jsonOk } from '@/lib/hub/http';
import { listDigest } from '@/lib/hub/repository';

/** Janela máxima do Resumo aberto sob demanda. */
const MAX_SINCE_DAYS = 30;

/**
 * Resumo diário: publicações Normais dos canais seguidos desde o último resumo visto.
 * `?since=<ISO>` força a janela (Resumo aberto sob demanda), limitada aos últimos 30 dias.
 */
export const GET = hubRoute('digest:get', async ({ viewer, request }) => {
  const raw = new URL(request.url).searchParams.get('since');
  const parsed = raw ? Date.parse(raw) : NaN;
  const floor = Date.now() - MAX_SINCE_DAYS * 24 * 3600 * 1000;
  const since = Number.isNaN(parsed) ? undefined : new Date(Math.max(parsed, floor)).toISOString();
  return jsonOk(await listDigest(viewer, since));
});

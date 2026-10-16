import { hubRoute, jsonOk } from '@/lib/hub/http';
import { listDigest } from '@/lib/hub/repository';

/**
 * Resumo diário: publicações Normais dos canais seguidos desde o último resumo visto.
 * `?since=<ISO>` força a janela — usado pelo botão "Testar resumo", só para quem publica.
 */
export const GET = hubRoute('digest:get', async ({ viewer, request }) => {
  const raw = new URL(request.url).searchParams.get('since');
  const since = raw && viewer.isContentManager && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
  return jsonOk(await listDigest(viewer, since));
});

/**
 * Proxy server-side para `GET /api/hub/fluxos` do TrackFlow: catálogo de fluxos que a pessoa
 * pode abrir, para a página Solicitações (/applications). O TrackFlow já filtra por pessoa e
 * pelo piloto; fora dele a lista vem vazia.
 *
 *   GET → { fluxos: [{ id, sigla, nome, descricao, areaId, areaNome, path }] }
 */
import { proxyTrackflowGet } from '@/lib/trackflow/hub-proxy';

/** A página não espera o TrackFlow: sem resposta neste tempo, fica só a lista fixa. */
const UPSTREAM_TIMEOUT_MS = 8_000;

export async function GET(request: Request) {
  return proxyTrackflowGet(request, '/api/hub/fluxos', { timeoutMs: UPSTREAM_TIMEOUT_MS });
}

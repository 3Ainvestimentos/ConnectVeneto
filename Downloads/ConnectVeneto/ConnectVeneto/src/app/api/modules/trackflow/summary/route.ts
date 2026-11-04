/**
 * Proxy server-side para o endpoint /api/summary do TrackFlow.
 * Assina um hub JWT e encaminha a requisição de servidor para servidor.
 */
import { proxyTrackflowGet } from '@/lib/trackflow/hub-proxy';

export async function GET(request: Request) {
  return proxyTrackflowGet(request, '/api/summary');
}

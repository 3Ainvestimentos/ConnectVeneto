import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logSecurityEvent, securityErrorResponse } from '@/lib/security';
import { requireHubPilotViewer, type HubViewer } from './access';

export const jsonOk = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * Envolve uma rota do Hub: autentica (piloto), roda o handler e traduz os erros conhecidos.
 * Erro de validação vira 400 com a primeira mensagem; o resto, 500 sem detalhe.
 */
export function hubRoute<P = Record<string, string>>(
  name: string,
  handler: (ctx: { viewer: HubViewer; request: Request; params: P }) => Promise<Response>,
) {
  return async (request: Request, route: { params: Promise<P> }) => {
    try {
      const viewer = await requireHubPilotViewer(request.headers.get('Authorization'));
      const params = route?.params ? await route.params : ({} as P);
      return await handler({ viewer, request, params });
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json({ error: error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 });
      }
      // Regra de negócio com mensagem para quem publica (ex.: Aviso sem prazo, Evento sem data).
      if (error instanceof Error && error.message.startsWith('INVALID_POST:')) {
        return NextResponse.json({ error: error.message.slice('INVALID_POST:'.length) }, { status: 400 });
      }
      const known = securityErrorResponse(error);
      if (known) return known;
      logSecurityEvent(`[api/feed] unexpected error (${name})`, { error: error instanceof Error ? error.message : 'unknown' });
      return NextResponse.json({ error: 'Não foi possível concluir. Tente de novo.' }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

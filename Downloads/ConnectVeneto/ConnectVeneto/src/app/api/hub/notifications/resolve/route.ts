/**
 * Marca como lidas as notificações de uma pendência executada no módulo.
 * Só resolve notificações do próprio módulo emissor (source = issuer do JWT).
 *
 * POST /api/hub/notifications/resolve
 * Authorization: Bearer <jwt>
 * { externalRef, recipients?: string[] }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyModuleRequest } from '@/lib/hub-jwt';
import { resolveNotifications } from '@/lib/notifications/server';

const bodySchema = z.object({
  externalRef: z.string().trim().min(1).max(200),
  recipients: z.array(z.string().max(254)).max(100).optional(),
});

export async function POST(request: Request) {
  const moduleId = await verifyModuleRequest(request);
  if (!moduleId) {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corpo inválido', issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const resolved = await resolveNotifications(moduleId, parsed.data.externalRef, parsed.data.recipients);
    return NextResponse.json({ resolved });
  } catch (err) {
    console.error('[hub/notifications/resolve] erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

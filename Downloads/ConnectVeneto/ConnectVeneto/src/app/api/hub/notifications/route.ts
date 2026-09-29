/**
 * Emite notificações na Central de Notificações do hub.
 * Chamado server-to-server pelo módulo com JWT (issuer=moduleId, audience='connect-veneto').
 *
 * POST /api/hub/notifications
 * Authorization: Bearer <jwt>
 * { recipients: string[], title, body?, path?, externalRef?, readPolicy? }
 *
 * A origem (source) e o módulo do link vêm do issuer do JWT, nunca do corpo.
 * Ref: CONNECTVENETO_MODULE_PROTOCOL.md §Notificações
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyModuleRequest } from '@/lib/hub-jwt';
import { getHubModuleServer } from '@/lib/hub-modules/server';
import { createNotifications } from '@/lib/notifications/server';
import { isSafeRelativePath } from '@/lib/notifications/types';

const bodySchema = z.object({
  recipients: z.array(z.string().max(254)).min(1).max(100),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(500).optional().nullable(),
  path: z.string().refine(isSafeRelativePath, 'path deve ser relativo').optional().nullable(),
  externalRef: z.string().trim().min(1).max(200).optional().nullable(),
  readPolicy: z.enum(['on_open', 'on_resolve']).optional(),
});

export async function POST(request: Request) {
  const moduleId = await verifyModuleRequest(request);
  if (!moduleId) {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
  }

  const moduleConfig = await getHubModuleServer(moduleId);
  if (!moduleConfig || moduleConfig.kind !== 'embedded' || !moduleConfig.enabled) {
    return NextResponse.json({ error: 'Módulo não registrado' }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corpo inválido', issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.readPolicy === 'on_resolve' && !data.externalRef) {
    return NextResponse.json({ error: 'readPolicy on_resolve exige externalRef' }, { status: 400 });
  }

  try {
    const created = await createNotifications({
      source: moduleId,
      recipients: data.recipients,
      title: data.title,
      body: data.body ?? null,
      link: data.path ? { moduleId, path: data.path } : { moduleId, path: '/' },
      externalRef: data.externalRef ?? null,
      readPolicy: data.readPolicy ?? 'on_open',
    });
    return NextResponse.json({ created });
  } catch (err) {
    console.error('[hub/notifications] erro ao criar notificações:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

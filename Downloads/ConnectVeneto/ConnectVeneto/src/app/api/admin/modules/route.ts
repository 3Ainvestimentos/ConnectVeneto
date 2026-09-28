import { NextResponse } from 'next/server';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  logSecurityEvent,
  requireSuperAdmin,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { __resetHubModuleCache } from '@/lib/hub-modules/server';
import {
  ALLOWED_MODULE_HOST_SUFFIXES,
  FALLBACK_HUB_MODULES,
  HUB_MODULES_COLLECTION,
  RESERVED_SLUGS,
  embeddedModuleSchema,
  hubModuleSchema,
  internalModuleSchema,
  isAllowedModuleOrigin,
  type EmbeddedHubModule,
  type HubModule,
} from '@/config/modules';

/**
 * Cadastro de módulos do hub (coleção `hubModules`). Só super admin.
 * A coleção é somente-leitura no client (firestore.rules); toda escrita passa aqui.
 *
 * POST   /api/admin/modules              cria um módulo embarcado
 * POST   /api/admin/modules?action=seed  grava o registro padrão (docs que faltam)
 * PATCH  /api/admin/modules?id=<id>      edita um módulo
 * PUT    /api/admin/modules              reordena: { ids: string[] } na ordem do menu
 * DELETE /api/admin/modules?id=<id>      exclui um módulo embarcado
 */

const AUDIT_AND_DERIVED = { href: true, createdAt: true, updatedAt: true, updatedBy: true } as const;

const createPayloadSchema = embeddedModuleSchema
  .omit(AUDIT_AND_DERIVED)
  .extend({ order: embeddedModuleSchema.shape.order.optional() });

const embeddedPatchSchema = embeddedModuleSchema
  .omit({ ...AUDIT_AND_DERIVED, id: true, kind: true })
  .partial()
  .strict();

/** Páginas internas existem no código: pelo painel só se muda apresentação e visibilidade. */
const internalPatchSchema = internalModuleSchema
  .pick({ label: true, description: true, iconName: true, order: true, enabled: true, showInNav: true, noZoom: true })
  .partial()
  .strict();

const reorderSchema = z.object({ ids: z.array(z.string()).min(1).max(200) });

const jsonOk = (body: Record<string, unknown>) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

const badRequest = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const handleError = (error: unknown, action: string) => {
  const knownSecurityError = securityErrorResponse(error);
  if (knownSecurityError) {
    logSecurityEvent(`[api/admin/modules] security error (${action})`, {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return knownSecurityError;
  }
  logSecurityEvent(`[api/admin/modules] unexpected error (${action})`, {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return NextResponse.json({ error: 'Falha ao salvar o módulo.' }, { status: 500 });
};

const collectionRef = (db: Firestore) => db.collection(HUB_MODULES_COLLECTION);

async function loadAll(db: Firestore): Promise<HubModule[]> {
  const snap = await collectionRef(db).get();
  return snap.docs
    .map((doc) => hubModuleSchema.safeParse({ ...doc.data(), id: doc.id }))
    .filter((r): r is { success: true; data: HubModule } => r.success)
    .map((r) => r.data);
}

/** Regras que dependem do resto do registro ou do ambiente. Retorna a mensagem de erro, se houver. */
function validateEmbedded(mod: EmbeddedHubModule, others: HubModule[]): string | null {
  if ((RESERVED_SLUGS as readonly string[]).includes(mod.slug)) {
    return `O endereço /${mod.slug} já é usado por uma página do ConnectVeneto.`;
  }
  const clash = others.find(
    (m) => m.id !== mod.id && (m.href === `/${mod.slug}` || (m.kind === 'embedded' && m.slug === mod.slug)),
  );
  if (clash) return `O endereço /${mod.slug} já é usado por "${clash.label}".`;

  if (!isAllowedModuleOrigin(mod.url, process.env.NODE_ENV !== 'production')) {
    return `A URL do módulo precisa ser https e estar em ${ALLOWED_MODULE_HOST_SUFFIXES.join(' ou ')} (a CSP bloqueia outros domínios).`;
  }

  const prefix = `${mod.id}:`;
  const perms = [
    ...mod.defaultPermissions,
    ...mod.adminPermissions,
    ...mod.permissionCatalog.map((p) => p.key),
  ];
  const wrong = perms.find((p) => !p.startsWith(prefix));
  if (wrong) return `Permissão "${wrong}" deve começar com "${prefix}".`;

  return null;
}

const audit = (email: string | null, isNew: boolean) => {
  const now = new Date().toISOString();
  return {
    ...(isNew ? { createdAt: now } : {}),
    updatedAt: now,
    updatedBy: email ?? 'desconhecido',
  };
};

export async function POST(request: Request) {
  try {
    const context = await requireSuperAdmin(request.headers.get('Authorization'));
    const db = getFirestore(getFirebaseAdminApp());
    const action = new URL(request.url).searchParams.get('action');

    if (action === 'seed') {
      const existing = await collectionRef(db).get();
      const existingIds = new Set(existing.docs.map((d) => d.id));
      const batch = db.batch();
      const created: string[] = [];
      for (const mod of FALLBACK_HUB_MODULES) {
        if (existingIds.has(mod.id)) continue;
        batch.set(collectionRef(db).doc(mod.id), { ...stripUndefined(mod), ...audit(context.email, true) });
        created.push(mod.id);
      }
      if (created.length) await batch.commit();
      __resetHubModuleCache();
      logSecurityEvent('[api/admin/modules] registro padrão gravado', { email: context.email, created });
      return jsonOk({ ok: true, created });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = createPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return badRequest(issue ? `${issue.path.join('.') || 'payload'}: ${issue.message}` : 'Requisição inválida.');
    }

    const all = await loadAll(db);
    if (all.length === 0) {
      return badRequest('Grave o registro padrão antes de cadastrar módulos novos.', 409);
    }
    if (all.some((m) => m.id === parsed.data.id)) {
      return badRequest(`Já existe um módulo com id "${parsed.data.id}".`, 409);
    }

    const order = parsed.data.order ?? Math.max(-1, ...all.map((m) => m.order)) + 1;
    const mod: EmbeddedHubModule = embeddedModuleSchema.parse({
      ...parsed.data,
      order,
      href: `/${parsed.data.slug}`,
    });
    const problem = validateEmbedded(mod, all);
    if (problem) return badRequest(problem);

    await collectionRef(db).doc(mod.id).set({ ...stripUndefined(mod), ...audit(context.email, true) });
    __resetHubModuleCache();
    logSecurityEvent('[api/admin/modules] módulo criado', { email: context.email, moduleId: mod.id });
    return jsonOk({ ok: true, id: mod.id });
  } catch (error) {
    return handleError(error, 'POST');
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireSuperAdmin(request.headers.get('Authorization'));
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return badRequest('Informe o id do módulo.');

    const db = getFirestore(getFirebaseAdminApp());
    const all = await loadAll(db);
    const current = all.find((m) => m.id === id);
    if (!current) return badRequest('Módulo não encontrado no banco.', 404);

    const rawBody = await request.json().catch(() => null);
    const patchSchema = current.kind === 'embedded' ? embeddedPatchSchema : internalPatchSchema;
    const parsed = patchSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return badRequest(issue ? `${issue.path.join('.') || 'payload'}: ${issue.message}` : 'Requisição inválida.');
    }

    const merged = { ...current, ...parsed.data } as HubModule;
    if (merged.kind === 'embedded') merged.href = `/${merged.slug}`;
    const next = hubModuleSchema.safeParse(merged);
    if (!next.success) return badRequest(next.error.issues[0]?.message ?? 'Módulo inválido.');

    if (next.data.kind === 'embedded') {
      const problem = validateEmbedded(next.data, all);
      if (problem) return badRequest(problem);
    }

    await collectionRef(db).doc(id).set({ ...stripUndefined(next.data), ...audit(context.email, false) });
    __resetHubModuleCache();
    logSecurityEvent('[api/admin/modules] módulo atualizado', {
      email: context.email,
      moduleId: id,
      fields: Object.keys(parsed.data),
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'PATCH');
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireSuperAdmin(request.headers.get('Authorization'));
    const rawBody = await request.json().catch(() => null);
    const parsed = reorderSchema.safeParse(rawBody);
    if (!parsed.success) return badRequest('Informe { ids: string[] } na ordem desejada.');

    const db = getFirestore(getFirebaseAdminApp());
    const all = await loadAll(db);
    const known = new Set(all.map((m) => m.id));
    const unknown = parsed.data.ids.find((id) => !known.has(id));
    if (unknown) return badRequest(`Módulo "${unknown}" não está no banco.`, 404);

    const batch = db.batch();
    const now = audit(context.email, false);
    parsed.data.ids.forEach((id, index) => {
      batch.update(collectionRef(db).doc(id), { order: index, ...now });
    });
    await batch.commit();
    __resetHubModuleCache();
    logSecurityEvent('[api/admin/modules] ordem atualizada', { email: context.email });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'PUT');
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireSuperAdmin(request.headers.get('Authorization'));
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return badRequest('Informe o id do módulo.');

    const db = getFirestore(getFirebaseAdminApp());
    const ref = collectionRef(db).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return badRequest('Módulo não encontrado no banco.', 404);
    if (snap.data()?.kind !== 'embedded') {
      return badRequest('Páginas internas não podem ser excluídas; desative o item em vez disso.', 403);
    }

    await ref.delete();
    __resetHubModuleCache();
    logSecurityEvent('[api/admin/modules] módulo excluído', { email: context.email, moduleId: id });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE');
  }
}

/** Firestore Admin rejeita `undefined` em campos. */
function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

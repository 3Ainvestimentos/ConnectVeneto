import { z } from 'zod';
import seedData from './hub-modules.seed.json';

/**
 * Registro de módulos do hub (menu lateral + módulos embarcados via iframe/hub-auth).
 *
 * A fonte de verdade é a coleção Firestore `hubModules` (um documento por módulo,
 * doc id = `id`). Ela é somente-leitura no client; toda escrita passa por
 * `/api/admin/modules` (super admin, Admin SDK). Ver CONNECTVENETO_MODULE_PROTOCOL.md §14.
 *
 * `hub-modules.seed.json` é o estado inicial da coleção (lido por
 * `scripts/seed-hub-modules.mjs`) e também o fallback usado quando a coleção está
 * vazia ou inacessível — o menu nunca fica em branco por causa do banco.
 *
 * IMPORTANTE: qualquer usuário autenticado lê esta coleção. Nunca guarde segredos
 * aqui (o HUB_JWT_SECRET continua em env).
 */

export const HUB_MODULES_COLLECTION = 'hubModules';

export const MODULE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

/**
 * Domínios em que um módulo embarcado pode morar. Espelha o `frame-src` da CSP em
 * next.config.ts: um módulo fora daqui seria bloqueado pelo navegador.
 */
export const ALLOWED_MODULE_HOST_SUFFIXES = ['.azurewebsites.net', '.venetomfo.com.br'] as const;

/** Segmentos de rota que já existem no app e não podem virar slug de módulo. */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'applications',
  'area-logada',
  'audit',
  'bi',
  'bob-v2',
  'consulta',
  'dashboard',
  'documents',
  'guides',
  'labs',
  'login',
  'me',
  'meet-analyses',
  'news',
  'opportunity-map',
  'personal-panel',
  'portal-repasse',
  'rankings',
  'regras-comerciais',
  'requests',
  'test-sheet',
  '_next',
] as const;

const moduleIdSchema = z
  .string()
  .regex(MODULE_ID_PATTERN, 'Use só letras minúsculas, números e hífen (2 a 40 caracteres).');

/** Origem do módulo: protocolo + host (+ porta), sem caminho e sem barra final. */
export const moduleOriginSchema = z
  .string()
  .trim()
  .regex(/^https?:\/\/[a-z0-9.-]+(:\d{2,5})?$/i, 'Informe só a origem, ex.: https://app.azurewebsites.net');

const permissionKeySchema = z.string().trim().min(1).max(80);

const baseModuleFields = {
  id: moduleIdSchema,
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional(),
  iconName: z.string().trim().min(1).max(40),
  order: z.number().int().min(0).max(10000),
  enabled: z.boolean(),
  showInNav: z.boolean().default(true),
  href: z.string().startsWith('/'),
  noZoom: z.boolean().default(false),
  external: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
};

export const internalModuleSchema = z.object({
  ...baseModuleFields,
  kind: z.literal('internal'),
  /** Chave de CollaboratorPermissions que libera o item. null = todos. */
  permission: z.string().nullable().default(null),
  /** Permissões alternativas: qualquer uma delas também libera o item. */
  altPermissions: z.array(z.string()).default([]),
});

export const embeddedModuleSchema = z.object({
  ...baseModuleFields,
  kind: z.literal('embedded'),
  /** Segmento da URL no hub: /{slug}. Pode diferir do id (ex.: portal-repasse → dados-estrategicos). */
  slug: moduleIdSchema,
  /** Origem do módulo — src do iframe e targetOrigin do postMessage. */
  url: moduleOriginSchema,
  /** Rota de bootstrap do embed no módulo. */
  embedPath: z.string().startsWith('/').default('/embed'),
  /**
   * 'all': todos acessam por padrão (modulePermissions[id] = [] revoga).
   * 'explicit': só quem tem `${id}:view` em modulePermissions[id].
   */
  accessMode: z.enum(['all', 'explicit']),
  /** Permissões do token para quem não tem modulePermissions[id] (só accessMode 'all'). */
  defaultPermissions: z.array(permissionKeySchema).default([]),
  /** Permissões do token para super admins. */
  adminPermissions: z.array(permissionKeySchema).default([]),
  /** Sub-permissões exibidas em /{slug}/admin. */
  permissionCatalog: z
    .array(z.object({ key: permissionKeySchema, label: z.string().trim().min(1).max(60) }))
    .default([]),
  /** fullscreen = ocupa a área toda; framed = cabeçalho + cartão com borda. */
  layout: z.enum(['fullscreen', 'framed']).default('fullscreen'),
  /** Tema do skeleton exibido até o módulo sinalizar CV_MODULE_READY. */
  skeletonTheme: z.enum(['light', 'dark']).optional(),
});

export const hubModuleSchema = z.discriminatedUnion('kind', [internalModuleSchema, embeddedModuleSchema]);

export type InternalHubModule = z.infer<typeof internalModuleSchema>;
export type EmbeddedHubModule = z.infer<typeof embeddedModuleSchema>;
export type HubModule = z.infer<typeof hubModuleSchema>;

export const moduleViewKey = (moduleId: string) => `${moduleId}:view`;
export const moduleManageKey = (moduleId: string) => `${moduleId}:manage`;

export const isEmbeddedModule = (mod: HubModule): mod is EmbeddedHubModule => mod.kind === 'embedded';

export function sortHubModules<T extends Pick<HubModule, 'order' | 'label'>>(list: T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'));
}

/** Valida documentos crus; documento inválido é descartado (com aviso) em vez de quebrar o menu. */
export function parseHubModules(raw: unknown[]): HubModule[] {
  const parsed: HubModule[] = [];
  for (const item of raw) {
    const result = hubModuleSchema.safeParse(item);
    if (result.success) {
      parsed.push(result.data);
    } else {
      const id = (item as { id?: unknown } | null)?.id;
      console.warn(`[hubModules] documento inválido ignorado: ${String(id)}`, result.error.issues[0]);
    }
  }
  return sortHubModules(parsed);
}

export const FALLBACK_HUB_MODULES: HubModule[] = sortHubModules(
  z.array(hubModuleSchema).parse(seedData),
);

export function getFallbackHubModule(id: string): HubModule | undefined {
  return FALLBACK_HUB_MODULES.find((m) => m.id === id);
}

export function findEmbeddedModuleBySlug(
  modules: HubModule[],
  slug: string,
): EmbeddedHubModule | undefined {
  return modules.find((m): m is EmbeddedHubModule => isEmbeddedModule(m) && m.slug === slug);
}

export type ModuleAccess = { hasAccess: boolean; permissions: string[] };

/**
 * Regra única de acesso a um módulo embarcado, usada pelo menu, pela rota da página,
 * pela emissão do Module Token e pela lista de membros (/api/hub/members).
 *
 * `modulePerms` é `collaborator.modulePermissions?.[mod.id]`.
 */
export function resolveModuleAccess(
  mod: EmbeddedHubModule,
  modulePerms: string[] | undefined,
): ModuleAccess {
  const perms = Array.isArray(modulePerms) ? modulePerms.filter((p) => typeof p === 'string') : undefined;

  if (mod.accessMode === 'explicit') {
    const viewKey = moduleViewKey(mod.id);
    return perms?.includes(viewKey)
      ? { hasAccess: true, permissions: perms }
      : { hasAccess: false, permissions: [] };
  }

  // accessMode 'all': sem registro = acesso padrão; lista vazia = acesso revogado.
  if (perms === undefined) return { hasAccess: true, permissions: mod.defaultPermissions };
  if (perms.length === 0) return { hasAccess: false, permissions: [] };
  return { hasAccess: true, permissions: perms };
}

/** Hostname permitido para um módulo (mesma lista da CSP). localhost só fora de produção. */
export function isAllowedModuleOrigin(origin: string, allowLocalhost: boolean): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (allowLocalhost && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    return true;
  }
  return (
    parsed.protocol === 'https:' &&
    ALLOWED_MODULE_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix))
  );
}

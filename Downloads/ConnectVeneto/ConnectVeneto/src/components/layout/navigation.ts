"use client";

import type { CollaboratorPermissions } from "@/contexts/CollaboratorsContext";
import {
  isEmbeddedModule,
  resolveModuleAccess,
  type EmbeddedHubModule,
  type HubModule,
} from "@/config/modules";

/**
 * O menu lateral vem da coleção `hubModules` (ver useHubModules). Este arquivo só
 * guarda as regras de visibilidade.
 */

export type NavAccessContext = {
  permissions: CollaboratorPermissions;
  modulePermissions?: Record<string, string[]>;
  isSuperAdmin: boolean;
};

/** Acesso à página do módulo embarcado (independe de aparecer no menu). */
export function canAccessEmbeddedModule(mod: EmbeddedHubModule, ctx: NavAccessContext): boolean {
  if (!mod.enabled) return false;
  if (ctx.isSuperAdmin) return true;
  return resolveModuleAccess(mod, ctx.modulePermissions?.[mod.id]).hasAccess;
}

/** Um item aparece no menu se estiver ativo e o colaborador tiver acesso. */
export function canSeeHubModule(mod: HubModule, ctx: NavAccessContext): boolean {
  if (!mod.enabled || !mod.showInNav) return false;

  if (isEmbeddedModule(mod)) return canAccessEmbeddedModule(mod, ctx);

  if (!mod.permission) return true;
  const has = (key: string) => ctx.permissions[key as keyof CollaboratorPermissions] === true;
  return has(mod.permission) || mod.altPermissions.some(has);
}

/** Rotas sem zoom de conteúdo que não são itens do registro. */
const STATIC_NO_ZOOM_ROUTES = ["/admin/crm", "/admin/strategic-panel", "/personal-panel"];

export function isNoZoomPath(pathname: string, modules: HubModule[]): boolean {
  const routes = [...STATIC_NO_ZOOM_ROUTES, ...modules.filter((m) => m.noZoom).map((m) => m.href)];
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

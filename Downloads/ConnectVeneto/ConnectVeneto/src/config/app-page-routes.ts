/**
 * Rotas com `page.tsx` na área logada `(app)` e login.
 * Atualize ao adicionar ou remover telas — usado para filtrar telemetria de rotas antigas.
 */
const EXACT_APP_PAGE_PATHS = new Set<string>([
  "/applications",
  "/audit",
  "/audit/content-interaction",
  "/audit/workflow-analytics",
  "/audit/workflow-efficiency",
  "/admin",
  "/admin/content",
  "/admin/crm",
  "/admin/fab-messages",
  "/admin/opportunity-map",
  "/admin/strategic-panel",
  "/admin/travel-birthdays",
  "/admin/workflows",
  "/bi",
  "/bob-v2",
  "/consulta",
  "/dashboard",
  "/documents",
  "/documents/glossario",
  "/guides",
  "/login",
  "/me/tasks",
  "/meet-analyses",
  "/news",
  "/opportunity-map",
  "/personal-panel",
  "/requests",
  "/regras-comerciais",
  "/test-sheet",
]);

const DYNAMIC_PAGE_PATTERNS: RegExp[] = [
  /^\/meet-analyses\/[^/]+$/,
  /^\/admin\/polls\/[^/]+\/results$/,
];

export function normalizeLoggedPagePath(raw: string): string {
  let p = raw.trim();
  const q = p.indexOf("?");
  const h = p.indexOf("#");
  const cut = Math.min(
    q === -1 ? p.length : q,
    h === -1 ? p.length : h
  );
  p = p.slice(0, cut);
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

export function isKnownAppPagePath(rawPath: string): boolean {
  const path = normalizeLoggedPagePath(rawPath);
  if (EXACT_APP_PAGE_PATHS.has(path)) return true;
  return DYNAMIC_PAGE_PATTERNS.some((re) => re.test(path));
}

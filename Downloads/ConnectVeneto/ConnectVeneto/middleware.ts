import { NextResponse, type NextRequest } from "next/server";

/**
 * cv_session — cookie server-side (httpOnly, Secure, SameSite=Strict).
 * Contém o Firebase ID Token verificado pelo servidor em /api/me/session.
 * Não pode ser forjado via document.cookie (httpOnly) nem via script (inacessível ao JS).
 */
const SESSION_COOKIE_NAME = "cv_session";

/**
 * cv_auth — cookie legado (client-side, valor "1").
 * Mantido apenas para compatibilidade durante a transição.
 * Usuários que ainda têm este cookie (sessões anteriores à atualização) são aceitos
 * temporariamente — o cv_session será emitido no próximo /api/me/session.
 * Remover este fallback após ~30 dias de operação com o novo sistema.
 */
const LEGACY_COOKIE_NAME = "cv_auth";

/**
 * Allowlist do que é público. Todo o resto exige sessão — inclusive os módulos
 * embarcados, cujas rotas (/{slug}) vêm do registro `hubModules` e não são
 * conhecidas no build.
 *
 * `/api/*` fica de fora porque cada rota valida o próprio Bearer token (ou JWT do hub).
 * Arquivos estáticos já são excluídos pelo `matcher` abaixo.
 */
const PUBLIC_PATHS = new Set(["/", "/login"]);
const PUBLIC_PREFIXES = ["/api/", "/_next/"];

/** Mesmo critério do `matcher`: caminho cujo último segmento tem extensão é arquivo estático. */
const STATIC_FILE = /\.[^/]+$/;

function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname) || STATIC_FILE.test(pathname)) return false;
  return !PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Verifica se o valor do cookie cv_session tem a estrutura de um JWT válido.
 * Esta verificação é puramente estrutural (sem criptografia) — adequada para Edge.
 * A verificação criptográfica completa ocorre em cada API route via Firebase Admin SDK.
 *
 * Um Firebase ID Token é um JWT com 3 partes base64url separadas por pontos,
 * e tem comprimento mínimo de ~500 caracteres.
 */
function isJwtShaped(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split(".");
  // JWT sempre tem exatamente 3 partes (header.payload.signature)
  if (parts.length !== 3) return false;
  // Firebase ID Tokens têm comprimento típico > 500 chars; tokens forjados seriam muito curtos
  if (value.length < 100) return false;
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Verifica o cookie seguro primeiro (novo sistema)
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (isJwtShaped(sessionCookie)) {
    return NextResponse.next();
  }

  // Fallback: aceita o cookie legado durante o período de transição
  // TODO: remover este fallback após ~30 dias (meados de maio/2026)
  const hasLegacyCookie = Boolean(request.cookies.get(LEGACY_COOKIE_NAME)?.value);
  if (hasLegacyCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

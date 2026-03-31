import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "cv_auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/applications",
  "/documents",
  "/consulta",
  "/labs",
  "/store",
  "/requests",
  "/rankings",
  "/bi",
  "/opportunity-map",
  "/personal-panel",
  "/meet-analyses",
  "/me",
  "/bob-v2",
  "/audit",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasAuthCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (hasAuthCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

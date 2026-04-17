import { NextResponse } from 'next/server';

type ErrorDescriptor = {
  status: number;
  body: Record<string, unknown>;
};

const ERROR_MAP: Record<string, ErrorDescriptor> = {
  UNAUTHORIZED_MISSING_TOKEN: {
    status: 401,
    body: { error: 'Nao autorizado: token nao fornecido.' },
  },
  UNAUTHORIZED_INVALID_TOKEN: {
    status: 401,
    body: { error: 'Nao autorizado: token invalido.' },
  },
  FORBIDDEN_NON_CORPORATE_EMAIL: {
    status: 403,
    body: { error: 'Acesso negado: apenas contas corporativas podem acessar.' },
  },
  FORBIDDEN_SUPER_ADMIN_REQUIRED: {
    status: 403,
    body: { error: 'Acesso negado: requer permissao de Super Administrador.' },
  },
  SYSTEM_SETTINGS_NOT_FOUND: {
    status: 503,
    body: { error: 'Configuracao do sistema indisponivel.' },
  },
};

export function mapSecurityError(error: unknown): ErrorDescriptor | null {
  const message = error instanceof Error ? error.message : null;
  if (!message) return null;
  return ERROR_MAP[message] ?? null;
}

export function securityErrorResponse(error: unknown): ReturnType<typeof NextResponse.json> | null {
  const mapped = mapSecurityError(error);
  if (!mapped) return null;
  return NextResponse.json(mapped.body, { status: mapped.status });
}

export function internalErrorResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

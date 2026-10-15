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
  FORBIDDEN_REGRAS_COMERCIAIS_MANAGER_REQUIRED: {
    status: 403,
    body: { error: 'Acesso negado: requer permissao para editar o Mix de Servicos.' },
  },
  FORBIDDEN_COLLABORATOR_ADMIN_REQUIRED: {
    status: 403,
    body: { error: 'Acesso negado: requer permissao para cadastrar colaboradores.' },
  },
  FORBIDDEN_CONTENT_MANAGER_REQUIRED: {
    status: 403,
    body: { error: 'Acesso negado: requer permissao para gerenciar o conteudo da intranet.' },
  },
  FORBIDDEN_BIBLIOTECA_COMERCIAL_VIEWER_REQUIRED: {
    status: 403,
    body: { error: 'Acesso negado: requer acesso a Biblioteca Comercial.' },
  },
  FORBIDDEN_BIBLIOTECA_COMERCIAL_MANAGER_REQUIRED: {
    status: 403,
    body: { error: 'Acesso negado: requer permissao para gerenciar a Biblioteca Comercial.' },
  },
  FORBIDDEN_NO_EMAIL: {
    status: 403,
    body: { error: 'Acesso negado: conta sem e-mail.' },
  },
  FORBIDDEN_HUB_PILOT: {
    status: 403,
    body: { error: 'A nova Home ainda esta em piloto e nao foi liberada para voce.' },
  },
  FORBIDDEN_HUB_PUBLISHER: {
    status: 403,
    body: { error: 'Voce nao pode publicar neste canal.' },
  },
  FORBIDDEN_HUB_POST_OWNER: {
    status: 403,
    body: { error: 'So o autor da publicacao (ou a Comunicacao) pode fazer isso.' },
  },
  HUB_NOT_FOUND: {
    status: 404,
    body: { error: 'Publicacao nao encontrada.' },
  },
  SYSTEM_SETTINGS_NOT_FOUND: {
    status: 503,
    body: { error: 'Configuracao do sistema indisponivel.' },
  },
  OPENAI_NOT_CONFIGURED: {
    status: 503,
    body: { error: 'Assistente de IA indisponivel: OPENAI_API_KEY nao configurada.' },
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

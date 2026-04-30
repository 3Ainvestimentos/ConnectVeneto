/**
 * DELETE /api/auth/clear
 *
 * Limpa o cookie de sessão seguro (cv_session) server-side.
 * Chamado pelo AuthContext ao fazer logout ou ao detectar falha de autenticação.
 *
 * Não requer autenticação — limpar uma sessão inválida é uma operação segura.
 */
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'cv_session';

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  // Expira o cookie imediatamente
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}

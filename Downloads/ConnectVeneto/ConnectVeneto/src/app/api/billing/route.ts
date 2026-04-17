import { NextResponse } from 'next/server';
import {
  logSecurityEvent,
  requireSuperAdmin,
  securityErrorResponse,
} from '@/lib/security';

const mockBillingData = {
  currentMonth: 'Agosto 2024',
  daysInMonth: 31,
  currentDay: 15,
  services: [
    { id: 'hosting', name: 'App Hosting', cost: 12.5 },
    { id: 'firestore', name: 'Firestore', cost: 25.8 },
    { id: 'storage', name: 'Cloud Storage', cost: 5.2 },
    { id: 'auth', name: 'Authentication', cost: 2.15 },
    { id: 'genkit', name: 'Genkit / AI Models', cost: 45.75 },
  ],
};

type ErrorWithCode = Error & { code?: string };

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request.headers.get('Authorization'));
    return NextResponse.json(mockBillingData);
  } catch (error: unknown) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/billing] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    const err = error as ErrorWithCode;

    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return NextResponse.json(
        { error: 'Token de autenticação inválido ou expirado.' },
        { status: 401 }
      );
    }

    logSecurityEvent('[api/billing] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Erro interno do servidor ao buscar dados de faturamento.' },
      { status: 500 }
    );
  }
}

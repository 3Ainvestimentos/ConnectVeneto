import { NextResponse } from 'next/server';
import { readOrgUnits } from '@/lib/hub/org-units-server';
import { logSecurityEvent, requireCorporateUser, securityErrorResponse } from '@/lib/security';

/** Estrutura organizacional (ADR 0004) para qualquer colaborador logado. */
export async function GET(request: Request) {
  try {
    await requireCorporateUser(request.headers.get('Authorization'));
    return NextResponse.json({ units: await readOrgUnits() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const known = securityErrorResponse(error);
    if (known) return known;
    logSecurityEvent('[api/org/units] falha', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Não foi possível ler a estrutura.' }, { status: 500 });
  }
}

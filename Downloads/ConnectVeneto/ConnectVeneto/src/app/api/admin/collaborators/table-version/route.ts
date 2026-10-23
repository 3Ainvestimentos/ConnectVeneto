import { NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  logSecurityEvent,
  requireCollaboratorAdmin,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { syncOrgDerivedFields } from '@/lib/hub/org-derived-server';

/**
 * Incrementa `systemSettings/config.collaboratorTableVersion` depois de criar,
 * importar ou excluir colaboradores.
 *
 * O RH (`collaboratorAdminEmails`) pode criar colaboradores pelas rules, mas
 * `systemSettings/config` só aceita escrita de super admin. Gravar o contador
 * pelo client dava `permission-denied` depois do cadastro já salvo — o RH via
 * erro, tentava de novo e duplicava o colaborador.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCollaboratorAdmin(request.headers.get('Authorization'));

    // Cadastro novo (o client grava direto): área, equipe e líder vêm da unidade escolhida.
    // Best-effort: falhar aqui não pode impedir a versão de subir.
    await syncOrgDerivedFields({ by: auth.email ?? 'desconhecido' }).catch((error) =>
      logSecurityEvent('[api/admin/collaborators/table-version] falha ao derivar da estrutura', {
        error: error instanceof Error ? error.message : 'unknown',
      })
    );

    const db = getFirestore(getFirebaseAdminApp());
    const configRef = db.collection('systemSettings').doc('config');
    await configRef.update({ collaboratorTableVersion: FieldValue.increment(1) });

    const updated = await configRef.get();
    const version = updated.data()?.collaboratorTableVersion;

    return NextResponse.json(
      { collaboratorTableVersion: typeof version === 'number' ? version : null },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/admin/collaborators/table-version] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/admin/collaborators/table-version] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Falha ao atualizar a versão da tabela.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import {
  logSecurityEvent,
  requireSuperAdmin,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

type AdminSettingsResponse = {
  superAdminEmails: string[];
  collaboratorAdminEmails: string[];
  allowedUserIds: string[];
};

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request.headers.get('Authorization'));

    const app = getFirebaseAdminApp();
    const db = getFirestore(app);

    // Uma lista só: `config`, a mesma que as rules e `requireSuperAdmin` leem e onde a tela grava.
    const configDoc = await db.collection('systemSettings').doc('config').get();
    const configData = configDoc.exists ? configDoc.data() ?? {} : {};

    const pick = (key: string): string[] => {
      const fromConfig = configData[key];
      if (Array.isArray(fromConfig)) {
        return (fromConfig as unknown[]).filter((v): v is string => typeof v === 'string');
      }
      return [];
    };

    const payload: AdminSettingsResponse = {
      superAdminEmails: pick('superAdminEmails'),
      collaboratorAdminEmails: pick('collaboratorAdminEmails'),
      allowedUserIds: pick('allowedUserIds'),
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/admin/settings] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/admin/settings] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Falha ao carregar configuracao administrativa.' },
      { status: 500 }
    );
  }
}

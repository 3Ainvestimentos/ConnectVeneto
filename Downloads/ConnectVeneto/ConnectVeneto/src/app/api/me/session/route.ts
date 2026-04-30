import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import {
  logSecurityEvent,
  requireCorporateUser,
  securityErrorResponse,
} from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { normalizeEmail } from '@/lib/email-utils';

type SessionResponse = {
  uid: string;
  email: string | null;
  isSuperAdmin: boolean;
  // Campos seguros de systemSettings usados pela UI comum.
  // IMPORTANTE: `superAdminEmails` e `collaboratorAdminEmails` NUNCA entram aqui.
  maintenanceMode: boolean;
  maintenanceMessage: string;
  isAllowedDuringMaintenance: boolean;
  termsUrl: string;
  termsVersion: number;
  privacyPolicyUrl: string;
  privacyPolicyVersion: number;
  collaboratorTableVersion: number;
  isRssNewsletterActive: boolean;
  rssNewsletterUrl: string;
  loginFrequencyGoal: number;
};

type RawSettings = {
  superAdminEmails: string[];
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedUserIds: string[];
  termsUrl: string;
  termsVersion: number;
  privacyPolicyUrl: string;
  privacyPolicyVersion: number;
  collaboratorTableVersion: number;
  isRssNewsletterActive: boolean;
  rssNewsletterUrl: string;
  loginFrequencyGoal: number;
};

/** Coerce util: string[] de qualquer fonte. */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/** Coerce util: valor com default. */
function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

async function readSystemSettingsServerSide(): Promise<RawSettings> {
  const app = getFirebaseAdminApp();
  const db = getFirestore(app);

  // Preferencia: admin_config para campos sensiveis (alvo da migracao do Parcial 7).
  // Fallback: config (estado atual, ainda mantido para compatibilidade).
  const [adminDoc, configDoc] = await Promise.all([
    db.collection('systemSettings').doc('admin_config').get(),
    db.collection('systemSettings').doc('config').get(),
  ]);

  const adminData = adminDoc.exists ? adminDoc.data() ?? {} : {};
  const configData = configDoc.exists ? configDoc.data() ?? {} : {};

  const pickList = (key: string): string[] =>
    toStringList(adminData[key]).length
      ? toStringList(adminData[key])
      : toStringList(configData[key]);

  return {
    superAdminEmails: pickList('superAdminEmails'),
    allowedUserIds: pickList('allowedUserIds'),
    maintenanceMode: boolOr(configData.maintenanceMode, false),
    maintenanceMessage: stringOr(configData.maintenanceMessage, ''),
    termsUrl: stringOr(configData.termsUrl, ''),
    termsVersion: numberOr(configData.termsVersion, 1),
    privacyPolicyUrl: stringOr(configData.privacyPolicyUrl, ''),
    privacyPolicyVersion: numberOr(configData.privacyPolicyVersion, 1),
    collaboratorTableVersion: numberOr(configData.collaboratorTableVersion, 1),
    isRssNewsletterActive: boolOr(configData.isRssNewsletterActive, false),
    rssNewsletterUrl: stringOr(configData.rssNewsletterUrl, ''),
    loginFrequencyGoal: numberOr(configData.loginFrequencyGoal, 12),
  };
}

async function resolveMaintenanceAccess(
  uid: string,
  normalizedEmail: string | null,
  allowedUserIds: string[],
): Promise<boolean> {
  if (allowedUserIds.length === 0) return false;

  const app = getFirebaseAdminApp();
  const db = getFirestore(app);

  try {
    const byAuthUid = await db
      .collection('collaborators')
      .where('authUid', '==', uid)
      .limit(1)
      .get();
    if (!byAuthUid.empty) {
      const idVeneto = byAuthUid.docs[0]?.data()?.idVeneto;
      return typeof idVeneto === 'string' && allowedUserIds.includes(idVeneto);
    }

    if (!normalizedEmail) return false;

    const byEmail = await db
      .collection('collaborators')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();
    if (byEmail.empty) return false;

    const idVeneto = byEmail.docs[0]?.data()?.idVeneto;
    return typeof idVeneto === 'string' && allowedUserIds.includes(idVeneto);
  } catch {
    // Fail closed: erro de lookup nunca libera bypass de manutencao.
    return false;
  }
}

const SESSION_COOKIE_NAME = 'cv_session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 horas

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const context = await requireCorporateUser(authHeader);

    const settings = await readSystemSettingsServerSide();
    const normalizedEmail = normalizeEmail(context.email);
    const normalizedAdminEmails = settings.superAdminEmails
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => email !== null);

    const isSuperAdmin =
      !!normalizedEmail && normalizedAdminEmails.includes(normalizedEmail);
    const isAllowedDuringMaintenance = await resolveMaintenanceAccess(
      context.uid,
      normalizedEmail,
      settings.allowedUserIds,
    );

    // `superAdminEmails` NAO e incluido na resposta. Esse e o ponto central do
    // fechamento do Finding F-01: o browser de um usuario comum nunca recebe
    // a lista de super admins.
    const payload: SessionResponse = {
      uid: context.uid,
      email: normalizedEmail,
      isSuperAdmin,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      isAllowedDuringMaintenance,
      termsUrl: settings.termsUrl,
      termsVersion: settings.termsVersion,
      privacyPolicyUrl: settings.privacyPolicyUrl,
      privacyPolicyVersion: settings.privacyPolicyVersion,
      collaboratorTableVersion: settings.collaboratorTableVersion,
      isRssNewsletterActive: settings.isRssNewsletterActive,
      rssNewsletterUrl: settings.rssNewsletterUrl,
      loginFrequencyGoal: settings.loginFrequencyGoal,
    };

    const response = NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });

    // Seta o cookie de sessão seguro (httpOnly, Secure, SameSite=Strict) server-side.
    // O valor é o Firebase ID Token — verificável criptograficamente, não trivialmente forjável.
    // Isso substitui o `cv_auth=1` definido via document.cookie no cliente (que qualquer
    // usuário poderia forjar para bypassar o middleware).
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (idToken) {
      response.cookies.set(SESSION_COOKIE_NAME, idToken, {
        httpOnly: true,                                          // não acessível via JS/XSS
        secure: process.env.NODE_ENV === 'production',          // apenas HTTPS em produção
        sameSite: 'strict',                                     // bloqueia envio cross-site
        maxAge: SESSION_COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/me/session] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/me/session] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Falha ao resolver sessao do usuario.' },
      { status: 500 }
    );
  }
}

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

export async function GET(request: Request) {
  try {
    const context = await requireCorporateUser(request.headers.get('Authorization'));

    const settings = await readSystemSettingsServerSide();
    const normalizedEmail = normalizeEmail(context.email);
    const normalizedAdminEmails = settings.superAdminEmails
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => email !== null);

    const isSuperAdmin =
      !!normalizedEmail && normalizedAdminEmails.includes(normalizedEmail);

    // `superAdminEmails` NAO e incluido na resposta. Esse e o ponto central do
    // fechamento do Finding F-01: o browser de um usuario comum nunca recebe
    // a lista de super admins.
    const payload: SessionResponse = {
      uid: context.uid,
      email: normalizedEmail,
      isSuperAdmin,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      allowedUserIds: settings.allowedUserIds,
      termsUrl: settings.termsUrl,
      termsVersion: settings.termsVersion,
      privacyPolicyUrl: settings.privacyPolicyUrl,
      privacyPolicyVersion: settings.privacyPolicyVersion,
      collaboratorTableVersion: settings.collaboratorTableVersion,
      isRssNewsletterActive: settings.isRssNewsletterActive,
      rssNewsletterUrl: settings.rssNewsletterUrl,
      loginFrequencyGoal: settings.loginFrequencyGoal,
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
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

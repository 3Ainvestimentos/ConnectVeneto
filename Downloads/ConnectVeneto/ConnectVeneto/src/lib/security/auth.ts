import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { verifyCorporateRequest } from '@/lib/api-auth';

const emailSchema = z.string().trim().toLowerCase().email();

export type AuthenticatedRequestContext = {
  uid: string;
  email: string | null;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const parsed = emailSchema.safeParse(email);
  return parsed.success ? parsed.data : null;
}

export async function requireCorporateUser(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext> {
  const result = await verifyCorporateRequest(authorizationHeader);

  return {
    uid: result.uid,
    email: normalizeEmail(result.email),
  };
}

/**
 * Lê `systemSettings/config.superAdminEmails` e diz se o e-mail está lá.
 * Lança `SYSTEM_SETTINGS_NOT_FOUND` se a configuração não existir — decisão de
 * privilégio nunca é tomada com base em configuração ausente (fail-closed).
 */
async function isSuperAdminEmail(email: string | null): Promise<boolean> {
  const app = getFirebaseAdminApp();
  const db = getFirestore(app);
  const settingsDoc = await db.collection('systemSettings').doc('config').get();

  if (!settingsDoc.exists) {
    throw new Error('SYSTEM_SETTINGS_NOT_FOUND');
  }

  const settingsData = settingsDoc.data();
  const superAdminEmails = Array.isArray(settingsData?.superAdminEmails)
    ? settingsData.superAdminEmails
    : [];

  const normalizedAdminEmails = superAdminEmails
    .map((candidate) => normalizeEmail(candidate))
    .filter((candidate): candidate is string => candidate !== null);

  return !!email && normalizedAdminEmails.includes(email);
}

export async function requireSuperAdmin(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext> {
  const context = await requireCorporateUser(authorizationHeader);

  if (!(await isSuperAdminEmail(context.email))) {
    throw new Error('FORBIDDEN_SUPER_ADMIN_REQUIRED');
  }

  return context;
}

/**
 * Busca a permissão de um colaborador no Firestore. Tenta primeiro pelo `authUid`
 * (vínculo forte) e depois pelo e-mail normalizado, que é como a base de RH é importada.
 */
async function collaboratorHasPermission(
  context: AuthenticatedRequestContext,
  permissionKey: string
): Promise<boolean> {
  const app = getFirebaseAdminApp();
  const db = getFirestore(app);
  const collaborators = db.collection('collaborators');

  const byUid = await collaborators.where('authUid', '==', context.uid).limit(1).get();
  const snapshot = byUid.empty && context.email
    ? await collaborators.where('email', '==', context.email).limit(1).get()
    : byUid;

  if (snapshot.empty) return false;

  const permissions = snapshot.docs[0].data()?.permissions;
  return !!permissions && permissions[permissionKey] === true;
}

/**
 * Autoriza a edição do carrossel "Apresentação — Mix de Serviços".
 * Super admins passam sempre; demais precisam de `permissions.canManageRegrasComerciais`.
 */
export async function requireRegrasComerciaisManager(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext> {
  const context = await requireCorporateUser(authorizationHeader);

  if (await isSuperAdminEmail(context.email)) {
    return context;
  }

  if (await collaboratorHasPermission(context, 'canManageRegrasComerciais')) {
    return context;
  }

  throw new Error('FORBIDDEN_REGRAS_COMERCIAIS_MANAGER_REQUIRED');
}

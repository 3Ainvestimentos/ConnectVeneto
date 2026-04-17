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

export async function requireSuperAdmin(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext> {
  const context = await requireCorporateUser(authorizationHeader);
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
    .map((email) => normalizeEmail(email))
    .filter((email): email is string => email !== null);

  if (!context.email || !normalizedAdminEmails.includes(context.email)) {
    throw new Error('FORBIDDEN_SUPER_ADMIN_REQUIRED');
  }

  return context;
}

import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

const CORPORATE_EMAIL_DOMAIN = 'venetomfo.com.br';

export function isCorporateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${CORPORATE_EMAIL_DOMAIN}`);
}

export async function verifyCorporateRequest(
  authorizationHeader: string | null
): Promise<{ email?: string | null; uid: string }> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED_MISSING_TOKEN');
  }

  const idToken = authorizationHeader.split('Bearer ')[1];
  if (!idToken) {
    throw new Error('UNAUTHORIZED_INVALID_TOKEN');
  }

  const app = getFirebaseAdminApp();
  const auth = getAuth(app);
  const decodedToken = await auth.verifyIdToken(idToken);

  if (!isCorporateEmail(decodedToken.email)) {
    throw new Error('FORBIDDEN_NON_CORPORATE_EMAIL');
  }

  return {
    email: decodedToken.email,
    uid: decodedToken.uid,
  };
}


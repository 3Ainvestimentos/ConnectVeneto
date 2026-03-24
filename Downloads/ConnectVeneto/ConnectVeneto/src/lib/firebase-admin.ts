
import { initializeApp, getApps, getApp, App, cert } from 'firebase-admin/app';

type ServiceAccountFromEnv = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function getServiceAccountFromEnv(): ServiceAccountFromEnv | null {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  const hasAnyServiceAccountVar = !!(projectId || clientEmail || rawPrivateKey);
  if (!hasAnyServiceAccountVar) return null;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      'Configuração incompleta do Firebase Admin na Vercel. ' +
      'Defina FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY.'
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, '\n'),
  };
}

// Esta função garante que o app admin do Firebase seja inicializado apenas uma vez (padrão Singleton)
export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccount = getServiceAccountFromEnv();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn(
      'AVISO: Credenciais de Admin do Firebase não encontradas.' +
      'A verificação de token no backend falhará. ' +
      'Use GOOGLE_APPLICATION_CREDENTIALS localmente ou FIREBASE_ADMIN_* na Vercel.'
    );
  }

  return initializeApp();
}

    
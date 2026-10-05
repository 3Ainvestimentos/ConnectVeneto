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
 * Lê uma lista de e-mails de `systemSettings/config` e diz se o e-mail está nela.
 * Lança `SYSTEM_SETTINGS_NOT_FOUND` se a configuração não existir — decisão de
 * privilégio nunca é tomada com base em configuração ausente (fail-closed).
 */
async function isEmailInSettingsList(
  email: string | null,
  listKey: 'superAdminEmails' | 'collaboratorAdminEmails'
): Promise<boolean> {
  const app = getFirebaseAdminApp();
  const db = getFirestore(app);
  const settingsDoc = await db.collection('systemSettings').doc('config').get();

  if (!settingsDoc.exists) {
    throw new Error('SYSTEM_SETTINGS_NOT_FOUND');
  }

  const settingsData = settingsDoc.data();
  const listedEmails = Array.isArray(settingsData?.[listKey])
    ? settingsData[listKey]
    : [];

  const normalizedEmails = listedEmails
    .map((candidate: unknown) => normalizeEmail(typeof candidate === 'string' ? candidate : null))
    .filter((candidate: string | null): candidate is string => candidate !== null);

  return !!email && normalizedEmails.includes(email);
}

async function isSuperAdminEmail(email: string | null): Promise<boolean> {
  return isEmailInSettingsList(email, 'superAdminEmails');
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
 * Autoriza o RH a cadastrar colaboradores — mesmo critério da rule de create em
 * `collaborators`: super admin ou e-mail em `collaboratorAdminEmails`.
 */
export async function requireCollaboratorAdmin(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext & { isSuperAdmin: boolean }> {
  const context = await requireCorporateUser(authorizationHeader);

  if (await isSuperAdminEmail(context.email)) {
    return { ...context, isSuperAdmin: true };
  }

  if (await isEmailInSettingsList(context.email, 'collaboratorAdminEmails')) {
    return { ...context, isSuperAdmin: false };
  }

  throw new Error('FORBIDDEN_COLLABORATOR_ADMIN_REQUIRED');
}

/** Diz se um e-mail qualquer (não o do requisitante) está em `superAdminEmails`. */
export async function isSuperAdminAddress(email: string | null | undefined): Promise<boolean> {
  return isSuperAdminEmail(normalizeEmail(email));
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

/**
 * Autoriza a gestão de conteúdo da intranet (hoje: notícias em /admin/content).
 * Super admins passam sempre; demais precisam de `permissions.canManageContent`.
 *
 * As rules do Firestore não conseguem consultar o documento do colaborador por
 * e-mail (IDs são auto-gerados), por isso `newsItems` é somente-leitura pelo
 * client e toda escrita passa por aqui.
 */
export async function requireContentManager(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext> {
  const context = await requireCorporateUser(authorizationHeader);

  if (await isSuperAdminEmail(context.email)) {
    return context;
  }

  if (await collaboratorHasPermission(context, 'canManageContent')) {
    return context;
  }

  throw new Error('FORBIDDEN_CONTENT_MANAGER_REQUIRED');
}

/**
 * A busca da Biblioteca Comercial cobre os dois acervos, mas o repositório interno
 * tem permissão própria: quem só tem acesso comercial não pode receber documentos
 * internos nos resultados.
 */
export async function canViewInternalDocuments(
  context: AuthenticatedRequestContext
): Promise<boolean> {
  if (await isSuperAdminEmail(context.email)) return true;
  return collaboratorHasPermission(context, 'canViewDocuments');
}

/**
 * Autoriza a leitura da Biblioteca Comercial (busca por IA e acervo).
 * Quem gerencia também pode ver — a permissão de gestão implica a de visualização.
 */
export async function requireBibliotecaComercialViewer(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext> {
  const context = await requireCorporateUser(authorizationHeader);

  if (await isSuperAdminEmail(context.email)) {
    return context;
  }

  if (
    (await collaboratorHasPermission(context, 'canViewBibliotecaComercial')) ||
    (await collaboratorHasPermission(context, 'canManageBibliotecaComercial'))
  ) {
    return context;
  }

  throw new Error('FORBIDDEN_BIBLIOTECA_COMERCIAL_VIEWER_REQUIRED');
}

/**
 * Autoriza escrita na Biblioteca Comercial (subir, editar e excluir documentos).
 * As rules do Firestore só liberam leitura da coleção: a permissão mora no
 * documento do colaborador, que elas não conseguem consultar por e-mail.
 */
export async function requireBibliotecaComercialManager(
  authorizationHeader: string | null
): Promise<AuthenticatedRequestContext> {
  const context = await requireCorporateUser(authorizationHeader);

  if (await isSuperAdminEmail(context.email)) {
    return context;
  }

  if (await collaboratorHasPermission(context, 'canManageBibliotecaComercial')) {
    return context;
  }

  throw new Error('FORBIDDEN_BIBLIOTECA_COMERCIAL_MANAGER_REQUIRED');
}

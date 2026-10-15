/**
 * Quem está chamando as APIs do Hub de Comunicação e o que pode fazer.
 * Mesmo padrão do resto do Connect: as rules do Firestore não leem as flags do colaborador,
 * então as coleções `hub*` são fechadas ao client e toda leitura/escrita passa por aqui.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { normalizeEmail } from '@/lib/email-utils';
import { requireCorporateUser } from '@/lib/security';
import { resolveModuleAccess } from '@/config/modules';
import { getHubModuleServer } from '@/lib/hub-modules/server';
import { HUB_PILOT_MODULE_ID, type HubChannel } from './model';

export interface HubViewer {
  uid: string;
  email: string;
  name: string;
  position?: string;
  isSuperAdmin: boolean;
  /** Comunicação/RH: publica em qualquer canal e modera tudo. */
  isContentManager: boolean;
  modulePermissions: Record<string, string[]>;
}

async function superAdminEmails(): Promise<string[]> {
  const db = getFirestore(getFirebaseAdminApp());
  // Super admin vive em duas listas (front e rules/auth.ts); vale estar em qualquer uma.
  const [adminDoc, configDoc] = await Promise.all([
    db.collection('systemSettings').doc('admin_config').get(),
    db.collection('systemSettings').doc('config').get(),
  ]);
  return [...((adminDoc.data()?.superAdminEmails ?? []) as string[]), ...((configDoc.data()?.superAdminEmails ?? []) as string[])]
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => !!e);
}

/** Autentica e carrega o colaborador (por authUid, depois por e-mail, como o resto do Connect). */
export async function getHubViewer(authorizationHeader: string | null): Promise<HubViewer> {
  const ctx = await requireCorporateUser(authorizationHeader);
  if (!ctx.email) throw new Error('FORBIDDEN_NO_EMAIL');

  const db = getFirestore(getFirebaseAdminApp());
  const collaborators = db.collection('collaborators');
  const byUid = await collaborators.where('authUid', '==', ctx.uid).limit(1).get();
  const snap = byUid.empty ? await collaborators.where('email', '==', ctx.email).limit(1).get() : byUid;
  const collab = snap.empty ? null : snap.docs[0].data();

  const isSuperAdmin = (await superAdminEmails()).includes(ctx.email);
  return {
    uid: ctx.uid,
    email: ctx.email,
    name: (collab?.name as string | undefined) ?? ctx.email.split('@')[0],
    position: collab?.position as string | undefined,
    isSuperAdmin,
    isContentManager: isSuperAdmin || collab?.permissions?.canManageContent === true,
    modulePermissions: (collab?.modulePermissions as Record<string, string[]> | undefined) ?? {},
  };
}

/**
 * Piloto: só entra quem tem `inicio:view` no módulo interno `inicio` (ou super admin).
 * Sem o módulo cadastrado, ninguém além de super admin entra (fail-closed).
 */
export async function requireHubPilotViewer(authorizationHeader: string | null): Promise<HubViewer> {
  const viewer = await getHubViewer(authorizationHeader);
  if (viewer.isSuperAdmin) return viewer;

  const mod = await getHubModuleServer(HUB_PILOT_MODULE_ID);
  if (!mod || !mod.enabled) throw new Error('FORBIDDEN_HUB_PILOT');
  if (!resolveModuleAccess(mod, viewer.modulePermissions[mod.id]).hasAccess) {
    throw new Error('FORBIDDEN_HUB_PILOT');
  }
  return viewer;
}

export function canPublishIn(viewer: HubViewer, channel: HubChannel): boolean {
  return channel.active && (viewer.isContentManager || channel.publisherEmails.includes(viewer.email));
}

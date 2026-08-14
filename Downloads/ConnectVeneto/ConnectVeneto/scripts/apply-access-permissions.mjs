/**
 * Script temporário: aplica permissões de painéis conforme o `accessType`
 * de cada colaborador (comercial | normal | admin | superadmin), definido
 * junto com a importação da planilha de RH.
 *
 * Regras (validadas com o responsável):
 * - canViewCRM / canViewOpportunityMap: false para todos (feature não implementada).
 * - canViewAudit / canManageSystem: restritos a superadmin.
 * - canViewPortalCliente / canViewPortalRepasse (+ modulePermissions correspondente,
 *   só 'view'): comercial, admin e superadmin. normal não recebe.
 * - trackflow: todo mundo recebe view/create; admin e superadmin recebem o conjunto
 *   completo (manage/admin/export).
 * - superadmin: recebe todas as flags true E é adicionado a `systemSettings/config.superAdminEmails`.
 *
 * Só atualiza colaboradores que já têm `accessType` preenchido. Não cria nem
 * remove documentos.
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-access-permissions.mjs --dry-run
 *   node --env-file=.env.local scripts/apply-access-permissions.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

const BASE_PERMISSIONS = {
  canManageWorkflows: false,
  canManageRequests: false,
  canManageContent: false,
  canManageTripsBirthdays: false,
  canManageVacation: false,
  canViewAudit: false,
  canManageSystem: false,
  canViewConsultaPessoal: false,
  canViewDocuments: true,
  canViewApplications: true,
  canViewRegrasComerciais: true,
  canManageRegrasComerciais: false,
  // Biblioteca Comercial é acervo aberto a toda a empresa, como o repositório interno.
  canViewBibliotecaComercial: true,
  canManageBibliotecaComercial: false,
  canViewTasks: false,
  canViewBI: false,
  canViewCRM: false,
  canViewStrategicPanel: false,
  canViewOpportunityMap: false,
  canViewMeetAnalyses: false,
  canViewDirectoria: false,
  canViewPortalRepasse: false,
  canViewPortalCliente: false,
};

const PERMISSIONS_BY_ACCESS_TYPE = {
  normal: {
    ...BASE_PERMISSIONS,
  },
  comercial: {
    ...BASE_PERMISSIONS,
    canViewPortalCliente: true,
    canViewPortalRepasse: true,
  },
  admin: {
    ...BASE_PERMISSIONS,
    canViewPortalCliente: true,
    canViewPortalRepasse: true,
    canViewBI: true,
    canViewStrategicPanel: true,
    canViewMeetAnalyses: true,
    canViewDirectoria: true,
    canViewConsultaPessoal: true,
    canManageContent: true,
    canManageRequests: true,
    canManageWorkflows: true,
    canManageTripsBirthdays: true,
    canManageVacation: true,
    canViewTasks: true,
  },
  superadmin: {
    ...Object.fromEntries(Object.keys(BASE_PERMISSIONS).map((k) => [k, true])),
    canViewCRM: false, // não implementado — nem superadmin usa
    canViewOpportunityMap: false,
  },
};

const TRACKFLOW_BASE = ['trackflow:view', 'trackflow:create'];
const TRACKFLOW_FULL = [...TRACKFLOW_BASE, 'trackflow:manage', 'trackflow:admin', 'trackflow:export'];

function modulePermissionsFor(accessType) {
  const modulePermissions = {
    trackflow: accessType === 'admin' || accessType === 'superadmin' ? TRACKFLOW_FULL : TRACKFLOW_BASE,
  };
  if (accessType === 'comercial' || accessType === 'admin') {
    modulePermissions['portal-repasse'] = ['portal-repasse:view'];
    modulePermissions['portal-cliente'] = ['portal-cliente:view'];
  }
  return modulePermissions;
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function run() {
  const snap = await db.collection('collaborators').get();

  const updates = [];
  const skippedNoAccessType = [];
  const superAdminEmailsToAdd = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const accessType = String(data.accessType ?? '').trim().toLowerCase();

    if (!PERMISSIONS_BY_ACCESS_TYPE[accessType]) {
      skippedNoAccessType.push({ email: data.email, name: data.name });
      continue;
    }

    // `canManageRegrasComerciais` é concedida individualmente (ver
    // scripts/grant-regras-comerciais-editors.mjs), não deriva do accessType —
    // preserva o valor atual para não revogar quem já tem.
    const permissions = {
      ...PERMISSIONS_BY_ACCESS_TYPE[accessType],
      canManageRegrasComerciais:
        accessType === 'superadmin' || data.permissions?.canManageRegrasComerciais === true,
      // Mesma lógica: quem cura a Biblioteca Comercial é escolhido a dedo
      // (scripts/grant-biblioteca-comercial-managers.mjs). Sem preservar aqui,
      // rodar este script revogaria a permissão de todos eles.
      canManageBibliotecaComercial:
        accessType === 'superadmin' || data.permissions?.canManageBibliotecaComercial === true,
    };
    const modulePermissions = modulePermissionsFor(accessType);

    updates.push({
      ref: docSnap.ref,
      email: data.email,
      name: data.name,
      accessType,
      permissions,
      modulePermissions,
    });

    if (accessType === 'superadmin' && data.email) {
      superAdminEmailsToAdd.push(String(data.email).trim().toLowerCase());
    }
  }

  console.log(`Colaboradores com accessType reconhecido: ${updates.length}`);
  console.log(`Colaboradores sem accessType (pulados, permissões não alteradas): ${skippedNoAccessType.length}`);
  if (skippedNoAccessType.length) {
    for (const s of skippedNoAccessType) console.log(`  - ${s.name} <${s.email}>`);
  }

  const byType = updates.reduce((acc, u) => {
    acc[u.accessType] = (acc[u.accessType] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\nDistribuição por tipo de acesso:', byType);

  console.log(`\nSerão adicionados a superAdminEmails: ${superAdminEmailsToAdd.length}`);
  for (const e of superAdminEmailsToAdd) console.log(`  - ${e}`);

  if (DRY_RUN) {
    console.log('\n(dry-run: nada foi gravado no Firestore)');
    return;
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const u of updates.slice(i, i + BATCH_SIZE)) {
      batch.update(u.ref, {
        permissions: u.permissions,
        modulePermissions: u.modulePermissions,
      });
    }
    await batch.commit();
  }
  console.log(`\n✅ Permissões atualizadas em ${updates.length} colaboradores.`);

  if (superAdminEmailsToAdd.length) {
    const configRef = db.collection('systemSettings').doc('config');
    await configRef.set(
      { superAdminEmails: FieldValue.arrayUnion(...superAdminEmailsToAdd) },
      { merge: true }
    );
    console.log(`✅ superAdminEmails atualizado em systemSettings/config (+${superAdminEmailsToAdd.length}).`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

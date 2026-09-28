/**
 * Migra o acesso aos módulos embarcados dos booleanos legados
 * (`permissions.canViewPortalRepasse` / `permissions.canViewPortalCliente`) para
 * `modulePermissions[moduleId]` contendo `<moduleId>:view` — a única fonte que o
 * token route, o menu e /api/hub/members passaram a ler.
 *
 * Fase 1 (padrão): aditiva. Para quem tem o booleano `true` e ainda não tem
 * `<id>:view`, acrescenta a permissão (mantém sub-permissões que já existam).
 * Também lista quem tem `<id>:view` SEM o booleano — essas pessoas passam a ter
 * acesso com o código novo. `--strict` remove a permissão delas.
 *
 * Fase 2 (--cleanup): apaga os dois booleanos dos documentos. Rode só depois que o
 * código novo estiver no ar.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-module-permissions.mjs                 # dry-run fase 1
 *   node --env-file=.env.local scripts/migrate-module-permissions.mjs --apply
 *   node --env-file=.env.local scripts/migrate-module-permissions.mjs --apply --strict
 *   node --env-file=.env.local scripts/migrate-module-permissions.mjs --cleanup --apply
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const STRICT = process.argv.includes('--strict');
const CLEANUP = process.argv.includes('--cleanup');

const LEGACY = [
  { flag: 'canViewPortalRepasse', moduleId: 'portal-repasse' },
  { flag: 'canViewPortalCliente', moduleId: 'portal-cliente' },
];

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
const snapshot = await db.collection('collaborators').get();
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — ${CLEANUP ? 'fase 2 (cleanup)' : `fase 1${STRICT ? ' (strict)' : ''}`} — ${snapshot.size} colaboradores`);

const updates = [];

for (const doc of snapshot.docs) {
  const data = doc.data();
  const label = `${data.name ?? '?'} <${data.email ?? doc.id}>`;
  const permissions = data.permissions ?? {};
  const modulePermissions = data.modulePermissions ?? {};

  if (CLEANUP) {
    const present = LEGACY.filter(({ flag }) => flag in permissions);
    if (!present.length) continue;
    const patch = Object.fromEntries(present.map(({ flag }) => [`permissions.${flag}`, FieldValue.delete()]));
    updates.push({ ref: doc.ref, patch });
    console.log(`  - ${label}: remove ${present.map((p) => p.flag).join(', ')}`);
    continue;
  }

  const patch = {};
  for (const { flag, moduleId } of LEGACY) {
    const viewKey = `${moduleId}:view`;
    const current = Array.isArray(modulePermissions[moduleId]) ? modulePermissions[moduleId] : [];
    const hasView = current.includes(viewKey);

    if (permissions[flag] === true && !hasView) {
      patch[`modulePermissions.${moduleId}`] = [viewKey, ...current];
      console.log(`  + ${label}: ${moduleId} ← ${viewKey}`);
    } else if (permissions[flag] !== true && hasView) {
      if (STRICT) {
        patch[`modulePermissions.${moduleId}`] = [];
        console.log(`  ! ${label}: tinha ${viewKey} sem ${flag}; acesso removido (--strict)`);
      } else {
        console.log(`  ? ${label}: tem ${viewKey} sem ${flag}; vai GANHAR acesso ao ${moduleId} com o código novo`);
      }
    }
  }
  if (Object.keys(patch).length) updates.push({ ref: doc.ref, patch });
}

console.log(`\n${updates.length} colaborador(es) a atualizar.`);
if (!APPLY) {
  console.log('Rode com --apply para gravar.');
  process.exit(0);
}

for (let i = 0; i < updates.length; i += 400) {
  const batch = db.batch();
  for (const { ref, patch } of updates.slice(i, i + 400)) batch.update(ref, patch);
  await batch.commit();
}
console.log('OK.');

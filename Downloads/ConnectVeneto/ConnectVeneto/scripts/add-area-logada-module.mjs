/**
 * Cadastra o módulo embarcado "Área Logada" (id `area-logada`, app.venetomfo.com.br) em
 * `hubModules`, DESATIVADO, e dá acesso só ao Victor para o teste
 * (pedido connect 2026-10-26-modulo-area-logada).
 * Idempotente: não sobrescreve o módulo se já existir; só acrescenta permissões que faltam.
 *
 * Usage:
 *   node --env-file=.env.local scripts/add-area-logada-module.mjs          # dry-run
 *   node --env-file=.env.local scripts/add-area-logada-module.mjs --apply
 *   node --env-file=.env.local scripts/add-area-logada-module.mjs --apply --acessos   # também concede acesso
 *   node --env-file=.env.local scripts/add-area-logada-module.mjs --apply --ativar    # enabled: true (após o deploy do hub)
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const GRANT_ACCESS = process.argv.includes('--acessos');
const ENABLE = process.argv.includes('--ativar');
const ID = 'area-logada';

const GRANTS = [{ email: 'victor.santos@venetomfo.com.br', perms: [`${ID}:view`] }];

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
db.settings({ preferRest: true });
const now = new Date().toISOString();

console.log(APPLY ? 'APLICANDO' : 'DRY-RUN');

const modules = await db.collection('hubModules').get();
const ref = db.collection('hubModules').doc(ID);
const existing = modules.docs.find((d) => d.id === ID);
if (existing) {
  const data = existing.data();
  console.log(`  = ${ID} já existe (mantido): ${data.label}, ${data.url}${data.embedPath}, enabled=${data.enabled}`);
  if (ENABLE && !data.enabled) {
    console.log(`  + ativa ${ID}`);
    if (APPLY) await ref.update({ enabled: true, updatedAt: now, updatedBy: 'scripts/add-area-logada-module.mjs' });
  }
} else {
  const order = Math.max(0, ...modules.docs.map((d) => d.data().order ?? 0)) + 1;
  const mod = {
    id: ID,
    kind: 'embedded',
    label: 'Área Logada',
    description: 'Carteiras dos clientes e validação dos relatórios mensais',
    // O pedido sugeria BriefcaseBusiness, que não está no iconMap (cairia no HelpCircle).
    iconName: 'Briefcase',
    order,
    enabled: ENABLE,
    showInNav: true,
    slug: ID,
    href: `/${ID}`,
    noZoom: true,
    external: false,
    url: 'https://app.venetomfo.com.br',
    // Barra final: o portal é export estático com trailingSlash.
    embedPath: '/embed/',
    accessMode: 'explicit',
    defaultPermissions: [],
    adminPermissions: [`${ID}:view`],
    permissionCatalog: [{ key: `${ID}:view`, label: 'Acessar' }],
    layout: 'fullscreen',
    createdAt: now,
    updatedAt: now,
    updatedBy: 'scripts/add-area-logada-module.mjs',
  };
  console.log(`  + cria ${ID} (ordem ${order}, ${mod.url}${mod.embedPath}, enabled=${mod.enabled})`);
  if (APPLY) await ref.set(mod);
}

const collaborators = GRANT_ACCESS ? await db.collection('collaborators').get() : { docs: [] };
for (const grant of GRANT_ACCESS ? GRANTS : []) {
  const matches = collaborators.docs.filter((d) => (d.data().email ?? '').toLowerCase() === grant.email);
  if (matches.length !== 1) {
    console.log(`  ! ${grant.email}: ${matches.length} colaboradores encontrados — pulado`);
    for (const m of matches) console.log(`      ${m.id} ${m.data().name} <${m.data().email}>`);
    continue;
  }
  const doc = matches[0];
  const c = doc.data();
  const current = c.modulePermissions?.[ID] ?? [];
  const missing = grant.perms.filter((p) => !current.includes(p));
  if (!missing.length) {
    console.log(`  = ${c.name} <${c.email}> já tem ${current.join(', ')}`);
    continue;
  }
  console.log(`  + ${c.name} <${c.email}>: ${missing.join(', ')}`);
  if (APPLY) await doc.ref.update({ [`modulePermissions.${ID}`]: [...current, ...missing] });
}

console.log(APPLY ? '\nOK.' : '\nRode com --apply para gravar.');
process.exit(0);

/**
 * Cadastra o módulo embarcado "Legal Advisory" (id `legal-advisory`, CRM do Legal em
 * vnt-crm-legal.azurewebsites.net) em `hubModules`, DESATIVADO, e dá acesso só ao Victor para o
 * teste como head (pedidos connect 2026-10-27-modulo-legal-advisory e
 * 2026-10-28-url-do-modulo-legal-advisory).
 * Idempotente: não sobrescreve o módulo se já existir; só acrescenta permissões que faltam.
 *
 * Usage:
 *   node --env-file=.env.local scripts/add-legal-advisory-module.mjs          # dry-run (lista a ordem atual do menu)
 *   node --env-file=.env.local scripts/add-legal-advisory-module.mjs --apply
 *   node --env-file=.env.local scripts/add-legal-advisory-module.mjs --apply --acessos   # também concede acesso
 *   node --env-file=.env.local scripts/add-legal-advisory-module.mjs --apply --ativar    # enabled: true
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const GRANT_ACCESS = process.argv.includes('--acessos');
const ENABLE = process.argv.includes('--ativar');
const ID = 'legal-advisory';
const SCRIPT = 'scripts/add-legal-advisory-module.mjs';

// Acesso de teste: o Victor como head do Legal (view + manage). A equipe vem depois.
const GRANTS = [{ email: 'victor.santos@venetomfo.com.br', perms: [`${ID}:view`, `${ID}:manage`] }];

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
console.log('Menu atual (order, id, enabled, showInNav, iconName):');
for (const d of [...modules.docs].sort((a, b) => (a.data().order ?? 0) - (b.data().order ?? 0))) {
  const m = d.data();
  console.log(`  ${String(m.order ?? '-').padStart(3)}  ${d.id}  enabled=${m.enabled}  nav=${m.showInNav}  ${m.iconName}`);
}

const ref = db.collection('hubModules').doc(ID);
const existing = modules.docs.find((d) => d.id === ID);
if (existing) {
  const data = existing.data();
  console.log(`  = ${ID} já existe (mantido): ${data.label}, ${data.url}${data.embedPath}, enabled=${data.enabled}`);
  if (ENABLE && !data.enabled) {
    console.log(`  + ativa ${ID}`);
    if (APPLY) await ref.update({ enabled: true, updatedAt: now, updatedBy: SCRIPT });
  }
} else {
  // Último lugar do menu, depois do maior `order` atual (não colide com ninguém).
  const order = Math.max(0, ...modules.docs.map((d) => d.data().order ?? 0)) + 1;
  const mod = {
    id: ID,
    kind: 'embedded',
    label: 'Legal Advisory',
    description: 'CRM do Legal: grupos atendidos, estrutura, biblioteca jurídica e rotinas',
    // O pedido sugeria Scale, que não está em MODULE_ICONS (cairia no Puzzle).
    iconName: 'ShieldCheck',
    order,
    enabled: ENABLE,
    showInNav: true,
    slug: ID,
    href: `/${ID}`,
    noZoom: true,
    external: false,
    url: 'https://vnt-crm-legal.azurewebsites.net',
    embedPath: '/embed',
    accessMode: 'explicit',
    defaultPermissions: [],
    adminPermissions: [`${ID}:view`, `${ID}:manage`],
    // O acesso (`:view`) é a coluna própria do AccessManager; o catálogo lista só o extra.
    permissionCatalog: [{ key: `${ID}:manage`, label: 'Head do Legal' }],
    layout: 'fullscreen',
    skeletonTheme: 'light',
    createdAt: now,
    updatedAt: now,
    updatedBy: SCRIPT,
  };
  console.log(`  + cria ${ID} (ordem ${order}, ${mod.url}${mod.embedPath}, ícone ${mod.iconName}, enabled=${mod.enabled})`);
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

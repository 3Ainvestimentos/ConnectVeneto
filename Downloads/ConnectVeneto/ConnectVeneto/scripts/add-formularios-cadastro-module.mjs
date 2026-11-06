/**
 * Cadastra o módulo embarcado "Formulários de Cadastro" (id `formularios-cadastro`, repo
 * venetomfo/intranet-comercial) em `hubModules` e dá acesso ao piloto: a equipe de RH, o
 * Victor e a Ana Daldegan.
 *
 * - accessMode `explicit`: só quem tem `formularios-cadastro:view` abre /formularios-cadastro.
 * - showInNav `false`: a entrada definitiva é um link na pasta Cadastro de Solicitações
 *   (Admin › Conteúdo), a ser incluído quando o módulo for aberto a todos.
 *
 * Idempotente: não sobrescreve o módulo se já existir; só acrescenta permissões que faltam.
 *
 * Usage:
 *   node --env-file=.env.local scripts/add-formularios-cadastro-module.mjs                    # dry-run
 *   node --env-file=.env.local scripts/add-formularios-cadastro-module.mjs --apply
 *   node --env-file=.env.local scripts/add-formularios-cadastro-module.mjs --apply --acessos   # concede acesso
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const GRANT_ACCESS = process.argv.includes('--acessos');
const ID = 'formularios-cadastro';
const VIEW = `${ID}:view`;

/** Pessoas fora do RH que entram no piloto (e-mail exato ou trecho do nome). */
const EXTRA_PEOPLE = [
  { email: 'victor.santos@venetomfo.com.br' },
  { nameIncludes: 'daldegan' },
];

/** Área do colaborador considerada RH (sem acento, sem caixa). */
const isRhArea = (area) => {
  const a = String(area ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  return a === 'rh' || /\brh\b/.test(a) || a.includes('recursos humanos') || a.includes('gente e gestao');
};

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
  console.log(
    `  = ${ID} já existe (mantido): ${data.label}, ${data.url}${data.embedPath}, ` +
      `accessMode=${data.accessMode}, showInNav=${data.showInNav}, enabled=${data.enabled}`,
  );
} else {
  const order = Math.max(0, ...modules.docs.map((d) => d.data().order ?? 0)) + 1;
  const mod = {
    id: ID,
    kind: 'embedded',
    label: 'Formulários de Cadastro',
    description: 'Formulário KYC de cadastro de clientes',
    iconName: 'ClipboardList',
    order,
    enabled: true,
    showInNav: false,
    slug: ID,
    href: `/${ID}`,
    noZoom: true,
    external: false,
    url: 'https://forms-cadastro-huagcuese2auepgr.canadacentral-01.azurewebsites.net',
    embedPath: '/embed',
    accessMode: 'explicit',
    defaultPermissions: [],
    adminPermissions: [VIEW, `${ID}:admin`],
    permissionCatalog: [{ key: `${ID}:admin`, label: 'Admin do formulário' }],
    layout: 'fullscreen',
    createdAt: now,
    updatedAt: now,
    updatedBy: 'scripts/add-formularios-cadastro-module.mjs',
  };
  console.log(`  + cria ${ID} (ordem ${order}, ${mod.url}${mod.embedPath}, explicit, fora do menu, enabled)`);
  if (APPLY) await ref.set(mod);
}

const collaborators = await db.collection('collaborators').get();
const people = collaborators.docs.map((d) => ({ doc: d, c: d.data() }));

const rh = people.filter(({ c }) => isRhArea(c.area));
console.log(`\nRH (${rh.length}):`);
for (const { c } of rh) console.log(`    ${c.name} <${c.email}> — área "${c.area}"`);

const extras = [];
for (const want of EXTRA_PEOPLE) {
  const matches = people.filter(({ c }) =>
    want.email
      ? String(c.email ?? '').toLowerCase() === want.email
      : String(c.name ?? '').toLowerCase().includes(want.nameIncludes),
  );
  if (matches.length !== 1) {
    console.log(`  ! ${want.email ?? want.nameIncludes}: ${matches.length} colaboradores encontrados — pulado`);
    for (const { c } of matches) console.log(`      ${c.name} <${c.email}>`);
    continue;
  }
  extras.push(matches[0]);
}
console.log(`\nDemais pessoas do piloto (${extras.length}):`);
for (const { c } of extras) console.log(`    ${c.name} <${c.email}> — área "${c.area}"`);

const targets = new Map();
for (const p of [...rh, ...extras]) targets.set(p.doc.id, p);

console.log(GRANT_ACCESS ? '\nAcessos:' : '\nAcessos (use --acessos para conceder):');
for (const { doc, c } of targets.values()) {
  const current = c.modulePermissions?.[ID] ?? [];
  if (current.includes(VIEW)) {
    console.log(`  = ${c.name} <${c.email}> já tem ${VIEW}`);
    continue;
  }
  console.log(`  + ${c.name} <${c.email}>: ${VIEW}`);
  if (APPLY && GRANT_ACCESS) await doc.ref.update({ [`modulePermissions.${ID}`]: [...current, VIEW] });
}

console.log(APPLY ? '\nOK.' : '\nRode com --apply para gravar.');
process.exit(0);

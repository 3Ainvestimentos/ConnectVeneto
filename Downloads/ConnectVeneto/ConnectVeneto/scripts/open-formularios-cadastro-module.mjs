/**
 * Abre o módulo "Formulários de Cadastro" (id `formularios-cadastro`) a todos os colaboradores
 * e coloca o link na pasta Cadastro da página Solicitações. O piloto criado por
 * `add-formularios-cadastro-module.mjs` deixa de ser necessário: a demanda é da área de Cadastro e
 * qualquer pessoa pode responder o formulário.
 *
 * 1. `hubModules/formularios-cadastro`: accessMode `all`, defaultPermissions [`formularios-cadastro:view`].
 *    Continua fora do menu lateral (showInNav false).
 * 2. `solicitacoesConfig/areas`: acrescenta o item interno `/formularios-cadastro` (mesma aba) na área
 *    cujo título é "Cadastro" (sem acento, sem caixa). Se a área não existir, só avisa.
 *
 * Idempotente. Dry-run por padrão.
 *
 * Usage:
 *   node --env-file=.env.local scripts/open-formularios-cadastro-module.mjs           # dry-run
 *   node --env-file=.env.local scripts/open-formularios-cadastro-module.mjs --apply
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const ID = 'formularios-cadastro';
const VIEW = `${ID}:view`;
const AREA_TITLE = 'cadastro';
const ITEM = {
  kind: 'external',
  title: 'Formulário KYC',
  subtitle: 'Cadastro de clientes',
  href: `/${ID}`,
  newTab: false,
  trackingKey: 'cadastro_formulario_kyc',
};
const BY = 'scripts/open-formularios-cadastro-module.mjs';

const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

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

// 1. Módulo
const modRef = db.collection('hubModules').doc(ID);
const modSnap = await modRef.get();
if (!modSnap.exists) {
  console.log(`  ! hubModules/${ID} não existe — rode antes add-formularios-cadastro-module.mjs`);
  process.exit(1);
}
const mod = modSnap.data();
const defaults = mod.defaultPermissions ?? [];
if (mod.accessMode === 'all' && defaults.includes(VIEW)) {
  console.log(`  = módulo já aberto a todos (defaultPermissions ${defaults.join(', ')})`);
} else {
  console.log(`  + módulo: accessMode ${mod.accessMode} → all; defaultPermissions → [${VIEW}]`);
  if (APPLY) {
    await modRef.update({
      accessMode: 'all',
      defaultPermissions: [...new Set([...defaults, VIEW])],
      updatedAt: now,
      updatedBy: BY,
    });
  }
}

// 2. Link em Solicitações › Cadastro
const solRef = db.collection('solicitacoesConfig').doc('areas');
const solSnap = await solRef.get();
const areas = solSnap.exists ? solSnap.data().areas : null;
if (!Array.isArray(areas)) {
  console.log('  ! solicitacoesConfig/areas não existe (a página usa a lista fixa do código) — link não criado');
} else {
  console.log(`\nÁreas em Solicitações: ${areas.map((a) => a.title).join(' | ')}`);
  const idx = areas.findIndex((a) => normalize(a.title) === AREA_TITLE);
  if (idx === -1) {
    console.log(`  ! nenhuma área com título "Cadastro" — link não criado`);
  } else {
    const area = areas[idx];
    const items = area.items ?? [];
    const already = items.some((it) => it.href === ITEM.href || it.trackingKey === ITEM.trackingKey);
    if (already) {
      console.log(`  = "${area.title}" já tem o link ${ITEM.href}`);
    } else {
      console.log(`  + "${area.title}": novo item "${ITEM.title}" → ${ITEM.href} (posição ${items.length + 1})`);
      if (APPLY) {
        const next = areas.map((a, i) => (i === idx ? { ...a, items: [...items, ITEM] } : a));
        await solRef.update({ areas: next, updatedAt: now, updatedBy: BY });
      }
    }
  }
}

console.log(APPLY ? '\nOK.' : '\nRode com --apply para gravar.');
process.exit(0);

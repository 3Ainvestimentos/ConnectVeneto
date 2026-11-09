/**
 * Abre o módulo "Formulários de Cadastro" (id `formularios-cadastro`) a todos os colaboradores:
 * qualquer pessoa autenticada no Connect abre https://connect.venetomfo.com.br/formularios-cadastro.
 * O piloto criado por `add-formularios-cadastro-module.mjs` deixa de ser necessário: a demanda é da
 * área de Cadastro e qualquer pessoa pode responder o formulário.
 *
 * 1. `hubModules/formularios-cadastro`: accessMode `all`, defaultPermissions [`formularios-cadastro:view`].
 *    Continua fora do menu lateral (showInNav false).
 * 2. A página Solicitações NÃO é alterada. Uma versão anterior deste script acrescentava o item
 *    "Formulário KYC" na área Cadastro; aqui ele é removido (pelo trackingKey) se ainda existir.
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
/** Item que uma versão anterior deste script criou em Solicitações › Cadastro. */
const LEGACY_TRACKING_KEY = 'cadastro_formulario_kyc';
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

// 2. Solicitações fica como estava: remove o item criado por engano numa versão anterior.
const solRef = db.collection('solicitacoesConfig').doc('areas');
const solSnap = await solRef.get();
const areas = solSnap.exists ? solSnap.data().areas : null;
if (Array.isArray(areas)) {
  const idx = areas.findIndex((a) => normalize(a.title) === AREA_TITLE);
  const items = idx === -1 ? [] : areas[idx].items ?? [];
  const kept = items.filter((it) => it.trackingKey !== LEGACY_TRACKING_KEY);
  if (kept.length === items.length) {
    console.log('  = Solicitações sem o item criado por este script (nada a remover)');
  } else {
    console.log(`  - "${areas[idx].title}": remove "Formulário KYC" (${items.length} → ${kept.length} itens)`);
    if (APPLY) {
      const next = areas.map((a, i) => (i === idx ? { ...a, items: kept } : a));
      await solRef.update({ areas: next, updatedAt: now, updatedBy: BY });
    }
  }
  if (idx !== -1) {
    console.log(`\nItens de "${areas[idx].title}" ${APPLY ? 'após' : 'depois de aplicar'}:`);
    for (const it of kept) console.log(`    ${it.title} → ${it.href ?? '(info)'}`);
  }
}

console.log(APPLY ? '\nOK.' : '\nRode com --apply para gravar.');
process.exit(0);

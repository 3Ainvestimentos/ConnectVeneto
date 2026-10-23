/**
 * Migração para perfis de acesso (ADR 0005) sem mudar o acesso de ninguém.
 *
 * 1. Cria três perfis a partir do acesso real de hoje: o acesso mais comum entre quem tem
 *    `accessType` normal (Colaborador), comercial (Comercial) e admin (Administração).
 * 2. Dá a cada unidade com pessoas o perfil da maioria dos membros dela (superadmin conta como admin).
 * 3. Grava em cada pessoa os ajustes que fazem o perfil reproduzir exatamente o acesso que ela já tem.
 *    Confere: o recálculo depois da migração não muda ninguém.
 *
 * Quem está sem unidade (ex.: ocultos no Hub) fica sem perfil, com o acesso manual de hoje.
 * Não sobrescreve: se já houver perfis, aborta.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-access-profiles.mjs            # simulação
 *   node --env-file=.env.local scripts/migrate-access-profiles.mjs --apply    # grava
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const SOURCE = 'adr-0005-migracao';
const BY = 'script:migrate-access-profiles';

// Espelho de src/lib/access/catalog.ts (script em JS puro não importa TS).
const KEYS = [
  'canViewDocuments', 'canViewApplications', 'canViewRegrasComerciais', 'canViewBibliotecaComercial', 'canViewConsultaPessoal',
  'canManageContent', 'canManageTripsBirthdays', 'canManageVacation', 'canManageRequests', 'canManageWorkflows',
  'canManageRegrasComerciais', 'canManageBibliotecaComercial', 'canManageSystem', 'canViewAudit',
];
const DEFAULTS = { canViewDocuments: true, canViewApplications: true, canViewRegrasComerciais: true, canViewBibliotecaComercial: true };
// Itens do menu sem acesso próprio (seguem o do piloto): não entram nos perfis.
const SHARED = new Set(['pessoas', 'publicacoes']);

const PROFILES = [
  { id: 'colaborador', name: 'Colaborador', description: 'Acesso padrão de quem trabalha na Vêneto.', from: ['normal'] },
  { id: 'comercial', name: 'Comercial', description: 'Time comercial: portais de cliente e dados comerciais.', from: ['comercial'] },
  { id: 'administracao', name: 'Administração', description: 'Áreas de apoio que administram partes do Connect.', from: ['admin', 'superadmin'] },
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

const sortList = (l) => [...new Set(l)].sort();
const currentPerms = (d) => Object.fromEntries(KEYS.map((k) => [k, d.get('permissions')?.[k] ?? DEFAULTS[k] ?? false]));
const currentModules = (d) =>
  Object.fromEntries(Object.entries(d.get('modulePermissions') ?? {}).filter(([id]) => !SHARED.has(id)).map(([id, l]) => [id, sortList(l)]));
const signature = (perms, mods) => JSON.stringify([KEYS.filter((k) => perms[k]), Object.entries(mods).sort(([a], [b]) => a.localeCompare(b))]);

function effective(profile, overrides = {}) {
  const permissions = Object.fromEntries(KEYS.map((k) => [k, overrides.permissions?.[k] ?? profile.permissions.includes(k)]));
  const modules = Object.fromEntries(Object.entries(profile.modules).map(([id, l]) => [id, sortList(l)]));
  for (const [id, l] of Object.entries(overrides.modules ?? {})) {
    if (l === null) delete modules[id];
    else modules[id] = sortList(l);
  }
  return { permissions, modules };
}

/** Ajustes para o perfil reproduzir o acesso atual. Mesma regra de `overridesToMatch`. */
function overridesFor(profile, d) {
  const base = effective(profile);
  const perms = currentPerms(d);
  const mods = currentModules(d);
  const out = {};
  for (const k of KEYS) if (perms[k] !== base.permissions[k]) (out.permissions ??= {})[k] = perms[k];
  for (const id of new Set([...Object.keys(base.modules), ...Object.keys(mods)])) {
    const want = mods[id];
    const have = base.modules[id];
    const same = want === undefined ? have === undefined : have !== undefined && want.join('|') === have.join('|');
    if (!same) (out.modules ??= {})[id] = want === undefined ? null : want;
  }
  return out;
}

const [existing, unitSnap, collabSnap] = await Promise.all([db.collection('accessProfiles').limit(1).get(), db.collection('orgUnits').get(), db.collection('collaborators').get()]);
if (!existing.empty) {
  console.error('Já existem perfis de acesso: esta migração é só para o começo. Nada feito.');
  process.exit(1);
}
const docs = collabSnap.docs;
const typeOf = (d) => {
  const t = String(d.get('accessType') ?? '').trim().toLowerCase();
  return t === 'superadmin' ? 'admin' : t || 'normal';
};

// 1. Perfis: o acesso mais comum de cada grupo.
for (const p of PROFILES) {
  const group = docs.filter((d) => p.from.includes(String(d.get('accessType') ?? '').trim().toLowerCase()) && !d.get('hubHidden'));
  const freq = new Map();
  for (const d of group) {
    const sig = signature(currentPerms(d), currentModules(d));
    freq.set(sig, { n: (freq.get(sig)?.n ?? 0) + 1, d });
  }
  const top = [...freq.values()].sort((a, b) => b.n - a.n)[0];
  p.permissions = top ? KEYS.filter((k) => currentPerms(top.d)[k]) : KEYS.filter((k) => DEFAULTS[k]);
  p.modules = top ? currentModules(top.d) : {};
  p.groupSize = group.length;
  p.sameAsMode = top?.n ?? 0;
}
const profileByType = { normal: 'colaborador', comercial: 'comercial', admin: 'administracao' };
const profileById = new Map(PROFILES.map((p) => [p.id, p]));

// 2. Unidade com pessoas: perfil da maioria.
const unitAssign = new Map();
for (const u of unitSnap.docs) {
  const members = docs.filter((d) => d.get('unitId') === u.id && !d.get('hubHidden'));
  if (!members.length) continue;
  const votes = {};
  for (const d of members) votes[profileByType[typeOf(d)] ?? 'colaborador'] = (votes[profileByType[typeOf(d)] ?? 'colaborador'] ?? 0) + 1;
  const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  unitAssign.set(u.id, { name: u.get('name'), profileId: winner, votes, members: members.length });
}

// 3. Ajustes por pessoa (quem tem unidade com perfil).
const people = [];
for (const d of docs) {
  const unitId = d.get('unitId');
  const a = unitId ? unitAssign.get(unitId) : null;
  if (!a) continue;
  const profile = profileById.get(a.profileId);
  const overrides = overridesFor(profile, d);
  // Conferência: perfil + ajustes = acesso atual.
  const eff = effective(profile, overrides);
  const ok = signature(eff.permissions, eff.modules) === signature(currentPerms(d), currentModules(d));
  if (!ok) throw new Error(`Conferência falhou para ${d.get('name')}`);
  const n = Object.keys(overrides.permissions ?? {}).length + Object.keys(overrides.modules ?? {}).length;
  people.push({ d, overrides, n, profileId: a.profileId });
}

const label = (k) => k.replace(/^can(View|Manage)/, (m, v) => (v === 'View' ? 'ver ' : 'gerir '));
console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — perfis de acesso (ADR 0005)\n`);
for (const p of PROFILES) {
  console.log(`Perfil "${p.name}" (${p.id}) — base em ${p.groupSize} pessoas, ${p.sameAsMode} com exatamente este acesso`);
  console.log(`  permissões: ${p.permissions.map(label).join(', ') || '—'}`);
  console.log(`  módulos: ${Object.entries(p.modules).map(([id, l]) => `${id} [${l.join(', ') || 'bloqueado'}]`).join('; ') || '—'}`);
}
console.log('\nEquipes:');
for (const [, a] of unitAssign) console.log(`  ${a.name} → ${profileById.get(a.profileId).name}  (${a.members} pessoas; votos ${JSON.stringify(a.votes)})`);
const withAdj = people.filter((p) => p.n > 0);
console.log(`\nPessoas com perfil: ${people.length} · com ajustes: ${withAdj.length} · total de ajustes: ${withAdj.reduce((s, p) => s + p.n, 0)}`);
for (const p of withAdj.sort((a, b) => b.n - a.n)) {
  const parts = [
    ...Object.entries(p.overrides.permissions ?? {}).map(([k, v]) => `${v ? '+' : '−'}${label(k)}`),
    ...Object.entries(p.overrides.modules ?? {}).map(([id, l]) => `${id}=${l === null ? 'padrão' : l.length ? l.join('+') : 'bloqueado'}`),
  ];
  console.log(`  ${p.d.get('name')} (${profileById.get(p.profileId).name}): ${parts.join(', ')}`);
}
const noProfile = docs.filter((d) => !people.some((p) => p.d.id === d.id));
console.log(`\nSem perfil (acesso manual continua): ${noProfile.length} — ${noProfile.map((d) => d.get('name')).join(', ')}`);
console.log('Conferência: perfil + ajustes = acesso atual para todos. Nenhum acesso muda.');

if (!APPLY) {
  console.log('\nNada gravado. Rode com --apply para gravar.');
  process.exit(0);
}

const now = new Date().toISOString();
for (const p of PROFILES) {
  await db.collection('accessProfiles').doc(p.id).set({ name: p.name, description: p.description, permissions: p.permissions, modules: p.modules, createdAt: now, updatedAt: now, updatedBy: BY });
}
for (const [id, a] of unitAssign) {
  await db.collection('orgUnits').doc(id).update({ accessProfileId: a.profileId, updatedAt: now, updatedBy: BY });
  await db.collection('orgUnitLogs').add({ action: 'update', unitId: id, data: { accessProfileId: a.profileId }, by: BY, at: now, source: SOURCE });
}
const withOverrides = people.filter((p) => p.n > 0);
for (let i = 0; i < withOverrides.length; i += 200) {
  const batch = db.batch();
  for (const p of withOverrides.slice(i, i + 200)) {
    batch.update(p.d.ref, { accessOverrides: p.overrides });
    batch.create(db.collection('collaborator_logs').doc(), {
      collaboratorId: p.d.id,
      collaboratorName: p.d.get('name') ?? '',
      updatedBy: BY,
      updatedAt: now,
      source: SOURCE,
      changes: [{ field: 'accessOverrides', oldValue: null, newValue: p.overrides }],
    });
  }
  await batch.commit();
}
console.log(`\nOK: ${PROFILES.length} perfis, ${unitAssign.size} equipes com perfil, ${withOverrides.length} pessoas com ajustes.`);

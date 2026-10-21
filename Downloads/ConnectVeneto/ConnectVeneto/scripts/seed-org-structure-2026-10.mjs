/**
 * Estrutura das equipes enviada pelo Victor em 2026-10-21 (ADR 0004): cria as unidades com
 * responsável, encaixa cada pessoa e grava as exceções de gestor (assistentes que reportam a um
 * comercial, não ao responsável da equipe). Também marca como ocultas no Hub as contas de teste.
 *
 * Nomes da lista são curtos ("Gabriel Cruz"): casa quando todas as palavras aparecem no nome do
 * cadastro, a primeira como primeiro nome, e só se for uma pessoa. O que não casar aborta o --apply.
 *
 * Quem não está na lista provavelmente saiu: fica oculto no Hub e sai da unidade (reversível pelo
 * cadastro), menos quem está em KEEP. O acesso ao Connect não muda. As unidades antigas (as 18 Áreas
 * criadas do campo `area`) que ficarem sem ninguém visível são apagadas.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-org-structure-2026-10.mjs            # simulação
 *   node --env-file=.env.local scripts/seed-org-structure-2026-10.mjs --apply    # grava
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const SOURCE = 'adr-0004-estrutura-2026-10';

/** Área com pessoas direto (`members`) ou com Equipes (`teams`). Assistente: [nome, gestor]. */
const STRUCTURE = [
  { name: 'Tecnologia e Dados', leader: 'Victor Santos', members: ['Roberto Moreira', 'Gustavo Goudim'] },
  {
    name: 'Operações',
    leader: 'Tairine Bolina',
    teams: [
      { name: 'Mesa de Operações', leader: 'Tairine Bolina', members: ['Wesley Calazans', 'Gabriel Cruz', 'Bernardo Brasil', 'Marina Lima'] },
      { name: 'Cadastro', leader: 'Tairine Bolina', members: ['Leticya Martins', 'Carla Silveira', 'Jhenifer Sales'] },
      { name: 'Inteligência Financeira', leader: 'Tairine Bolina', members: ['Bernardo Turci', 'Giulia Loschiavo'] },
    ],
  },
  { name: 'Gestão de Patrimônio', leader: 'Henrique Galvão', members: ['Camila Martins', 'Alice Passos', 'Victor Rocha', 'Daniela Ferrari'] },
  { name: 'Recursos Humanos', leader: 'Fernanda Adami', members: ['Bruna Loren Barbosa Martinuzzo'] },
  {
    name: 'Corporativo',
    leader: 'Ana Catarina',
    teams: [
      { name: 'CX', leader: 'Ana Catarina', members: ['Daniela Soares'] },
      { name: 'Marketing', leader: 'Ana Catarina', members: ['Patrick Corrêa'] },
      { name: 'Novos Negócios', leader: 'Ana Catarina', members: ['Maria Naves'] },
      { name: 'Compliance', leader: 'Ana Catarina', members: ['Maria Clara Duraes'] },
    ],
  },
  { name: 'Expansão', leader: 'Fernando Damasceno', members: ['Maria Ferron'] },
  {
    name: 'Comercial',
    leader: null,
    teams: [
      { name: 'Comerciais – Farmers', leader: 'Heitor Macedo', members: ['Marco Jota'] },
      {
        name: 'Comerciais – BH',
        leader: 'Paulo Ribeiro',
        members: [
          'Bernardo Ottoni', 'Claudia Nogueira', 'Darlon Dutra', 'Glaucia Bambirra', 'Gustavo Oliveira', ['Gabriel Portela', 'Gustavo Oliveira'],
          'Igor Magalhães', ['Bruno Esteves', 'Igor Magalhães'], 'Julia Guimarães', 'Lucas Freitas', ['Ana Bacha', 'Lucas Freitas'], 'Lucas Bousas',
          'Fatima Bicalho', 'Pedro Ribeiro',
        ],
      },
      { name: 'Comerciais – Canal 3ARiva', leader: null, members: ['Renato Gomide', 'Tide Ferrão', 'Gustavo Couto', 'Gabriel Miranda'] },
      { name: 'Comerciais – Marketing Digital', leader: 'Paulo Ribeiro', members: ['Breno Fernandes', 'Victoria Nazareth'] },
      {
        name: 'Comerciais – SP',
        leader: 'Eduardo Oliveira',
        members: ['Breno Campos', ['Gustavo França', 'Breno Campos'], 'Camila Shimizu', 'Caco Santos', 'Daniel Urbani', 'Douglas Latorre', 'Felipe Milano', 'João Meirelles', 'Lucia Penteado', 'Thiago Samu', 'Ligia Andrade', 'Alexandre Dal Mas'],
      },
    ],
  },
  {
    name: 'Análise de Investimentos',
    leader: 'Rodrigo Donnard',
    members: ['Felipe Leal', 'Gustavo Zwetkoff', 'Keven Mendes', 'Lucas Costa', 'Lucas Pereira', 'Luis Gariglio', 'Pedro Cunha', 'Raphael Tarandach', 'Túlio Viana'],
  },
];

/** Contas de teste: somem do Hub (Pessoas, organograma, aniversários), o login continua igual. */
const HIDDEN = ['ti', 'Desenvolvedor', 'Teste Inteligência Comercial'];
/** Fora da lista, mas não saiu: sócio. */
const KEEP = [];
/** Topo da estrutura: a Diretoria com os sócios; todas as Áreas ficam dentro dela. */
const ROOT = { name: 'Diretoria', leader: null, members: ['Carlos Pessoa', 'Fernando Damasceno'] };
/** Nome da lista → nome no cadastro, quando nenhuma palavra bate (confirmado pelo idVeneto e pelos liderados). */
const ALIASES = { 'Ana Catarina': 'Ana Daldegan' };

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

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const [collabSnap, unitSnap] = await Promise.all([db.collection('collaborators').get(), db.collection('orgUnits').get()]);
const docs = collabSnap.docs;

const problems = [];
/** Primeiro nome igual e todas as palavras no nome do cadastro; nome exato vence. */
function find(listName) {
  const name = ALIASES[listName] ?? listName;
  const words = norm(name).split(' ');
  const exact = docs.filter((d) => norm(d.get('name')) === norm(name));
  if (exact.length === 1) return exact[0];
  const hits = docs.filter((d) => {
    const full = norm(d.get('name')).split(' ');
    return full[0] === words[0] && words.every((w) => full.includes(w));
  });
  if (hits.length === 1) return hits[0];
  // Cadastro com o nome mais curto que a lista ("Bruna Martinuzzo" ← "Bruna Loren Barbosa Martinuzzo").
  const shorter = docs.filter((d) => {
    const full = norm(d.get('name')).split(' ');
    return full[0] === words[0] && full.length > 1 && full.every((w) => words.includes(w));
  });
  if (hits.length === 0 && shorter.length === 1) return shorter[0];
  problems.push(`"${name}": ${hits.length === 0 ? 'ninguém no cadastro' : `${hits.length} pessoas (${hits.map((d) => d.get('name')).join(', ')})`}`);
  return null;
}

/** Plano: unidades (com chave local), pessoa → unidade, exceções de gestor. */
const units = [];
const placement = new Map(); // docId → unit key
const overrides = new Map(); // docId → idVeneto do gestor
const seenIn = new Map(); // docId → onde apareceu (para avisar de duplicidade)

function place(name, key, label) {
  const d = find(name);
  if (!d) return null;
  if (!placement.has(d.id)) placement.set(d.id, key); // a primeira unidade da lista vence (ex.: líder de várias)
  seenIn.set(d.id, [...(seenIn.get(d.id) ?? []), label]);
  return d;
}

function addUnit(def, type, parentKey) {
  const key = `${parentKey ?? ''}/${def.name}`;
  const leaderDoc = def.leader ? find(def.leader) : null;
  units.push({ key, name: def.name, type, parentKey, leaderIdVeneto: leaderDoc ? String(leaderDoc.get('idVeneto')).trim() : null, leaderName: leaderDoc?.get('name') ?? null });
  return { key, leaderDoc };
}

const { key: rootKey } = addUnit(ROOT, 'diretoria', null);
for (const m of ROOT.members) place(m, rootKey, ROOT.name);
for (const area of STRUCTURE) {
  const { key: areaKey, leaderDoc } = addUnit(area, 'area', rootKey);
  // Líder de várias equipes fica na Área; líder de uma só, na própria unidade.
  if (leaderDoc && !placement.has(leaderDoc.id)) placement.set(leaderDoc.id, areaKey);
  for (const m of area.members ?? []) {
    const [name, boss] = Array.isArray(m) ? m : [m, null];
    const d = place(name, areaKey, area.name);
    if (d && boss) {
      const b = find(boss);
      if (b) overrides.set(d.id, String(b.get('idVeneto')).trim());
    }
  }
  for (const team of area.teams ?? []) {
    const { key: teamKey, leaderDoc: teamLeader } = addUnit(team, 'equipe', areaKey);
    if (teamLeader && !placement.has(teamLeader.id)) placement.set(teamLeader.id, teamKey);
    for (const m of team.members) {
      const [name, boss] = Array.isArray(m) ? m : [m, null];
      const d = place(name, teamKey, team.name);
      if (d && boss) {
        const b = find(boss);
        if (b) overrides.set(d.id, String(b.get('idVeneto')).trim());
      }
    }
  }
}

const hidden = HIDDEN.map((n) => docs.find((d) => norm(d.get('name')) === norm(n))).filter(Boolean);
const placedIds = new Set(placement.keys());
const kept = KEEP.map((n) => docs.find((d) => norm(d.get('name')) === norm(n))).filter(Boolean);
const notListed = docs.filter((d) => !placedIds.has(d.id) && !hidden.includes(d) && !kept.includes(d));
const dupes = [...seenIn].filter(([, where]) => where.length > 1);

const label = (key) => units.find((u) => u.key === key)?.name;
console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — ${units.length} unidades, ${placement.size} pessoas, ${overrides.size} exceções de gestor`);
for (const u of units) {
  const people = docs.filter((d) => placement.get(d.id) === u.key).map((d) => d.get('name'));
  const depth = u.key.split('/').length - 2;
  console.log(`${'    '.repeat(depth)}${{ diretoria: 'Diretoria', area: 'Área', equipe: 'Equipe' }[u.type]} "${u.name}" · responsável: ${u.leaderName ?? '—'} · ${people.length}: ${people.join(', ')}`);
}
console.log('\nExceções de gestor:');
for (const [id, idV] of overrides) console.log(`  ${docs.find((d) => d.id === id).get('name')} → ${docs.find((d) => String(d.get('idVeneto')).trim() === idV)?.get('name')}`);
if (dupes.length) console.log('\nEm mais de uma unidade (fica na primeira):', dupes.map(([id, w]) => `${docs.find((d) => d.id === id).get('name')} [${w.join(', ')}]`).join('; '));
console.log(`\nOcultas no Hub (${hidden.length}): ${hidden.map((d) => d.get('name')).join(', ')}`);
console.log(`\nMantidos fora da lista: ${kept.map((d) => d.get('name')).join(', ')}`);
console.log(`\nFora da lista (${notListed.length}) — ficam ocultos no Hub e sem unidade:\n  ${notListed.map((d) => `${d.get('name')} <${d.get('email')}> [${d.get('area') ?? ''}]`).join('\n  ')}`);
const byEmail = new Map();
for (const d of docs) byEmail.set(norm(d.get('email')), [...(byEmail.get(norm(d.get('email'))) ?? []), d]);
for (const [email, list] of byEmail) {
  if (list.length > 1) console.log(`\nCADASTRO DUPLICADO ${email}: ${list.map((d) => `${d.id} (idVeneto ${d.get('idVeneto')}, authUid ${d.get('authUid') ? 'sim' : 'não'}, criado ${d.get('createdAt') ?? '?'})`).join(' | ')}`);
}
console.log(`\nUnidades antigas: ${unitSnap.size} (as que ficarem vazias serão apagadas)`);
if (problems.length) console.log(`\nNOMES SEM CASAMENTO (${problems.length}):\n  ${[...new Set(problems)].join('\n  ')}`);

if (!APPLY) {
  console.log('\nNada gravado. Rode com --apply para gravar.');
  process.exit(0);
}
if (problems.length) {
  console.error('\nAbortado: resolva os nomes acima antes de gravar.');
  process.exit(1);
}

const now = new Date().toISOString();
const by = 'script:seed-org-structure-2026-10';
const idOf = new Map();
// Reaproveita a unidade de mesmo tipo e nome (mesmo que mude de mãe), para o id não mudar a cada rodada.
const existingByKey = new Map(unitSnap.docs.map((d) => [`${d.get('type')}|${norm(d.get('name'))}`, d.id]));
// Do topo para baixo (cada unidade precisa do id da mãe).
for (const u of [...units].sort((a, b) => a.key.split('/').length - b.key.split('/').length)) {
  const parentId = u.parentKey ? idOf.get(u.parentKey) : null;
  const reuse = existingByKey.get(`${u.type}|${norm(u.name)}`);
  const data = { name: u.name, type: u.type, parentId, leaderIdVeneto: u.leaderIdVeneto, updatedAt: now, updatedBy: by };
  if (reuse) {
    await db.collection('orgUnits').doc(reuse).set(data, { merge: true });
    idOf.set(u.key, reuse);
  } else {
    const ref = await db.collection('orgUnits').add({ ...data, createdAt: now });
    idOf.set(u.key, ref.id);
  }
  await db.collection('orgUnitLogs').add({ unitId: idOf.get(u.key), action: reuse ? 'update' : 'create', data, updatedBy: by, updatedAt: now, source: SOURCE });
}

const writes = [];
for (const d of docs) {
  const changes = [];
  const update = {};
  const unitId = placement.has(d.id) ? idOf.get(placement.get(d.id)) : undefined;
  if (unitId && d.get('unitId') !== unitId) {
    update.unitId = unitId;
    changes.push({ field: 'unitId', oldValue: d.get('unitId') ?? null, newValue: unitId });
  }
  const override = overrides.get(d.id);
  if (override && d.get('managerOverrideIdVeneto') !== override) {
    update.managerOverrideIdVeneto = override;
    changes.push({ field: 'managerOverrideIdVeneto', oldValue: d.get('managerOverrideIdVeneto') ?? null, newValue: override });
  }
  if (notListed.includes(d) && d.get('unitId')) {
    update.unitId = '';
    changes.push({ field: 'unitId', oldValue: d.get('unitId'), newValue: '' });
  }
  if ((hidden.includes(d) || notListed.includes(d)) && d.get('hubHidden') !== true) {
    update.hubHidden = true;
    changes.push({ field: 'hubHidden', oldValue: d.get('hubHidden') ?? null, newValue: true });
  }
  if (changes.length) writes.push({ d, update, changes });
}
for (let i = 0; i < writes.length; i += 200) {
  const batch = db.batch();
  for (const { d, update, changes } of writes.slice(i, i + 200)) {
    batch.update(d.ref, update);
    batch.create(db.collection('collaborator_logs').doc(), { collaboratorId: d.id, collaboratorName: d.get('name') ?? '', updatedBy: by, updatedAt: now, source: SOURCE, changes });
  }
  await batch.commit();
}

// Unidades antigas que ficaram vazias (sem pessoas e sem filhas) saem.
const used = new Set(idOf.values());
const after = await db.collection('collaborators').get();
const withPeople = new Set(after.docs.filter((d) => d.get('hubHidden') !== true).map((d) => d.get('unitId')).filter(Boolean));
let removed = 0;
for (const u of unitSnap.docs) {
  if (used.has(u.id) || withPeople.has(u.id)) continue;
  // Alguém oculto ainda aponta para ela: tira a referência antes de apagar (o formulário rejeitaria unidade inexistente).
  for (const d of after.docs.filter((x) => x.get('unitId') === u.id)) {
    await d.ref.update({ unitId: '' });
    await db.collection('collaborator_logs').add({ collaboratorId: d.id, collaboratorName: d.get('name') ?? '', updatedBy: by, updatedAt: now, source: SOURCE, changes: [{ field: 'unitId', oldValue: u.id, newValue: '' }] });
  }
  await u.ref.delete();
  await db.collection('orgUnitLogs').add({ unitId: u.id, action: 'delete', data: u.data(), updatedBy: by, updatedAt: now, source: SOURCE });
  removed += 1;
}
console.log(`\nOK: ${idOf.size} unidades gravadas, ${writes.length} cadastros alterados, ${removed} unidades antigas vazias apagadas.`);

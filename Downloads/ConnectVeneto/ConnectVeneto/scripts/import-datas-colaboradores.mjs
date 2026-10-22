/**
 * Data de nascimento (`birthDate`) e data de entrada (`admissionDate`) a partir da planilha do RH
 * (colunas: Nome completo | Aniversário | Data de início). Grava AAAA-MM-DD.
 *
 * Datas: células de data do Excel valem pelo número de série (sem ambiguidade de formato); texto
 * só é aceito como DD/MM/AAAA. Nomes: a planilha traz o nome completo e o cadastro, às vezes, o
 * curto ("Ana Catharina Lopes Daldegan Cardoso" × "Ana Daldegan"): casa o nome exato ou, com o
 * mesmo primeiro nome, quando todas as palavras de um estão no outro — e só se for uma pessoa.
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-datas-colaboradores.mjs "<planilha.xlsx>"            # simulação
 *   node --env-file=.env.local scripts/import-datas-colaboradores.mjs "<planilha.xlsx>" --apply    # grava
 */
import { createRequire } from 'node:module';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const APPLY = process.argv.includes('--apply');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!FILE) {
  console.error('Informe o caminho da planilha.');
  process.exit(1);
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const pad = (n) => String(n).padStart(2, '0');

/** Célula → AAAA-MM-DD, ou null com o motivo. */
function toIso(cell, { minYear, maxYear }) {
  if (!cell) return { iso: null, why: 'vazio' };
  let y;
  let m;
  let d;
  if (cell.t === 'n') {
    const p = XLSX.SSF.parse_date_code(cell.v);
    if (!p) return { iso: null, why: `número inválido (${cell.v})` };
    ({ y, m, d } = p);
  } else if (cell.t === 's') {
    const t = cell.v.trim();
    const mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (!mt) return { iso: null, why: `texto fora do formato DD/MM/AAAA ("${t}")` };
    [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  } else if (cell.t === 'd') {
    const dt = cell.v;
    [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else {
    return { iso: null, why: `tipo de célula ${cell.t}` };
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return { iso: null, why: `data impossível (${d}/${m}/${y})` };
  if (y < minYear || y > maxYear) return { iso: null, why: `ano fora de ${minYear}–${maxYear} (${y})` };
  return { iso: `${y}-${pad(m)}-${pad(d)}` };
}

// Planilha
const wb = XLSX.readFile(FILE);
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']);
const header = [0, 1, 2].map((c) => norm(ws[XLSX.utils.encode_cell({ r: 0, c })]?.v));
if (!header[0].startsWith('nome') || !header[1].startsWith('aniversario') || !header[2].startsWith('data de ini')) {
  console.error('Cabeçalho inesperado:', header);
  process.exit(1);
}
const thisYear = new Date().getFullYear();
const rows = [];
for (let r = 1; r <= range.e.r; r++) {
  const name = String(ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v ?? '').trim();
  if (!name) continue;
  const birth = toIso(ws[XLSX.utils.encode_cell({ r, c: 1 })], { minYear: 1930, maxYear: thisYear - 14 });
  const admission = toIso(ws[XLSX.utils.encode_cell({ r, c: 2 })], { minYear: 1990, maxYear: thisYear + 1 });
  rows.push({ line: r + 1, name, birth, admission });
}

// Cadastro
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
const docs = (await db.collection('collaborators').get()).docs;

/** Nome da planilha → nome no cadastro, quando o primeiro nome muda (confirmado pela equipe e pelo sobrenome). */
const ALIASES = { 'maria de fatima bicalho lobenwein': 'Fatima Bicalho' };

function find(sheetName) {
  const name = ALIASES[norm(sheetName)] ?? sheetName;
  const exact = docs.filter((d) => norm(d.get('name')) === norm(name));
  if (exact.length === 1) return { doc: exact[0] };
  const words = norm(name).split(' ');
  const hits = docs.filter((d) => {
    const full = norm(d.get('name')).split(' ');
    if (full[0] !== words[0] || full.length < 2) return false;
    return full.every((w) => words.includes(w)) || words.every((w) => full.includes(w));
  });
  if (hits.length === 1) return { doc: hits[0] };
  return { why: hits.length === 0 ? 'ninguém no cadastro' : `${hits.length} pessoas (${hits.map((d) => d.get('name')).join(', ')})` };
}

const plan = [];
const problems = [];
const usedBy = new Map();
for (const row of rows) {
  const { doc, why } = find(row.name);
  if (!doc) {
    problems.push(`linha ${row.line} "${row.name}": ${why}`);
    continue;
  }
  if (usedBy.has(doc.id)) {
    problems.push(`linha ${row.line} "${row.name}": mesmo cadastro da linha ${usedBy.get(doc.id)} (${doc.get('name')})`);
    continue;
  }
  usedBy.set(doc.id, row.line);
  for (const [field, res] of [
    ['birthDate', row.birth],
    ['admissionDate', row.admission],
  ]) {
    if (!res.iso) {
      problems.push(`linha ${row.line} "${row.name}" · ${field}: ${res.why}`);
      continue;
    }
    const old = doc.get(field) ?? '';
    if (old === res.iso) continue;
    plan.push({ doc, field, old, value: res.iso, line: row.line });
  }
}

const matched = usedBy.size;
const notInSheet = docs.filter((d) => !usedBy.has(d.id));
console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO'} — ${rows.length} linhas na planilha, ${matched} casadas com o cadastro (${docs.length} cadastros)`);
const byDoc = new Map();
for (const p of plan) byDoc.set(p.doc.id, [...(byDoc.get(p.doc.id) ?? []), p]);
for (const [, ps] of byDoc) {
  const d = ps[0].doc;
  const sheetName = rows.find((r) => r.line === ps[0].line).name;
  const label = norm(sheetName) === norm(d.get('name')) ? d.get('name') : `${sheetName} → ${d.get('name')}`;
  console.log(`  ${label}${d.get('hubHidden') ? ' [oculto no Hub]' : ''}: ${ps.map((p) => `${p.field === 'birthDate' ? 'nasc.' : 'entrada'} ${p.old ? `${p.old} → ` : ''}${p.value}`).join(' · ')}`);
}
const changedOld = plan.filter((p) => p.old);
if (changedOld.length) console.log(`\n${changedOld.length} campo(s) já preenchido(s) com outro valor serão substituídos (marcados com →).`);
console.log(`\nCadastros fora da planilha (${notInSheet.length}): ${notInSheet.map((d) => `${d.get('name')}${d.get('hubHidden') ? ' [oculto]' : ''}`).join(', ')}`);
if (problems.length) console.log(`\nPROBLEMAS (${problems.length}):\n  ${problems.join('\n  ')}`);
console.log(`\n${plan.length} campo(s) a gravar em ${byDoc.size} cadastro(s).`);

if (!APPLY) {
  console.log('Nada gravado. Rode com --apply para gravar.');
  process.exit(0);
}

const now = new Date().toISOString();
const by = 'script:import-datas-colaboradores';
const entries = [...byDoc.values()];
for (let i = 0; i < entries.length; i += 200) {
  const batch = db.batch();
  for (const ps of entries.slice(i, i + 200)) {
    const d = ps[0].doc;
    batch.update(d.ref, Object.fromEntries(ps.map((p) => [p.field, p.value])));
    batch.create(db.collection('collaborator_logs').doc(), {
      collaboratorId: d.id,
      collaboratorName: d.get('name') ?? '',
      updatedBy: by,
      updatedAt: now,
      source: 'import-datas-2026-10',
      changes: ps.map((p) => ({ field: p.field, oldValue: p.old || null, newValue: p.value })),
    });
  }
  await batch.commit();
}
console.log(`OK: ${plan.length} campo(s) gravado(s) em ${entries.length} cadastro(s).`);

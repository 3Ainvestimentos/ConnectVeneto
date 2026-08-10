/**
 * Publica firestore.rules e/ou storage.rules via Firebase Rules API, usando o
 * service account de FIREBASE_ADMIN_* (o mesmo do resto dos scripts). Não depende
 * de `firebase login`.
 *
 * Por que existe, em vez de `npx firebase deploy --only firestore:rules`:
 * - mostra o diff entre o que está no ar e o arquivo local ANTES de publicar;
 * - imprime o ruleset atual para rollback;
 * - exige --apply para gravar (padrão é dry-run);
 * - é um comando fixo e auditável, então pode ser liberado na allowlist do Claude
 *   Code sem abrir `node` inteiro.
 *
 * O arquivo local pode estar mais ANTIGO que a produção (já aconteceu neste repo:
 * o firestore.rules versionado havia revertido o endurecimento de systemSettings).
 * Leia o diff. Um `-` no diff é uma proteção que você está removendo do ar.
 *
 * Usage:
 *   node --env-file=.env.local scripts/deploy-security-rules.mjs                    # dry-run, ambos
 *   node --env-file=.env.local scripts/deploy-security-rules.mjs --apply            # publica ambos
 *   node --env-file=.env.local scripts/deploy-security-rules.mjs --only=firestore --apply
 *   node --env-file=.env.local scripts/deploy-security-rules.mjs --rollback=<rulesetId> --only=firestore --apply
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

/**
 * Espelha toda a saída num arquivo. O terminal pode bufferizar (ou a pessoa pode
 * copiar antes do fim) e aí não se distingue "travou" de "ainda rodando" — o log
 * em disco sempre tem a última linha que o processo realmente chegou a emitir.
 */
const LOG_PATH = 'deploy-security-rules.log';
const transcript = [];

for (const channel of ['log', 'error']) {
  const original = console[channel].bind(console);
  console[channel] = (...args) => {
    transcript.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    original(...args);
  };
}

const flushLog = () => {
  try {
    writeFileSync(LOG_PATH, `${transcript.join('\n')}\n`);
  } catch {
    // Não deixa falha de escrita de log mascarar o resultado real.
  }
};
process.on('exit', flushLog);

const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const rollbackArg = process.argv.find((a) => a.startsWith('--rollback='));
const ONLY = onlyArg ? onlyArg.split('=')[1] : 'both';
const ROLLBACK_RULESET = rollbackArg ? rollbackArg.split('=')[1] : null;

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

/**
 * O nome do release NÃO é derivável do alvo: Firestore é `.../releases/cloud.firestore`,
 * mas Storage é `.../releases/firebase.storage/<bucket>` — com barra no meio do id.
 * Por isso o nome é resolvido pelo endpoint de lista, não montado à mão.
 */
const TARGETS = {
  firestore: {
    file: 'firestore.rules',
    matches: (name) => name.endsWith('/cloud.firestore'),
    describe: 'cloud.firestore',
  },
  storage: {
    file: 'storage.rules',
    matches: (name) => name.includes('/firebase.storage'),
    describe: `firebase.storage/${STORAGE_BUCKET ?? '<bucket>'}`,
  },
};

if (ONLY !== 'both' && !TARGETS[ONLY]) {
  console.error(`--only inválido: "${ONLY}". Use firestore, storage ou omita para ambos.`);
  process.exit(1);
}
if (ROLLBACK_RULESET && ONLY === 'both') {
  console.error('--rollback exige --only=firestore ou --only=storage (um alvo por vez).');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const app = getApps()[0];
let authHeaders;

/** Toda chamada de rede tem teto: um hang silencioso é pior que um erro. */
const NETWORK_TIMEOUT_MS = 30_000;

const step = (message) => console.log(`  … ${message}`);

async function headers() {
  if (!authHeaders) {
    step('obtendo access token do service account…');
    const token = await Promise.race([
      app.options.credential.getAccessToken(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`timeout de ${NETWORK_TIMEOUT_MS}ms obtendo access token`)),
          NETWORK_TIMEOUT_MS
        )
      ),
    ]);
    authHeaders = {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    };
    step('access token obtido.');
  }
  return authHeaders;
}

async function api(path, init) {
  const method = init?.method ?? 'GET';
  const resolvedHeaders = await headers();

  step(`${method} ${path.split('/').slice(-2).join('/')}…`);
  let response;
  try {
    response = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
      ...init,
      headers: resolvedHeaders,
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error(
        `${method} ${path} não respondeu em ${NETWORK_TIMEOUT_MS}ms. ` +
          'Verifique conectividade com firebaserules.googleapis.com (proxy/VPN corporativa?).'
      );
    }
    throw new Error(`${method} ${path} falhou na rede: ${error?.message ?? error}`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${method} ${path} -> HTTP ${response.status}: ${JSON.stringify(body).slice(0, 800)}`
    );
  }
  return body;
}

const normalize = (text) => text.replace(/\r\n/g, '\n').replace(/\s+$/, '');

/**
 * Diff de linhas por LCS, com contexto — sem dependências externas.
 *
 * Precisa ser um diff posicional de verdade, não uma comparação de multiconjuntos:
 * rules têm muitas linhas repetidas (`}`, vazias, `allow read: if isAuthenticated();`)
 * e um diff ingênuo afoga um `-` real (proteção sendo removida) em dezenas de
 * falsos `+`. O `-` é o sinal que importa na revisão.
 */
function diffLines(liveLines, localLines) {
  const n = liveLines.length;
  const m = localLines.length;

  // lcs[i][j] = tamanho da maior subsequência comum entre live[i..] e local[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        liveLines[i] === localLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (liveLines[i] === localLines[j]) {
      ops.push({ kind: ' ', line: liveLines[i], liveNo: i + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: '-', line: liveLines[i], liveNo: i + 1 });
      i++;
    } else {
      ops.push({ kind: '+', line: localLines[j] });
      j++;
    }
  }
  while (i < n) ops.push({ kind: '-', line: liveLines[i], liveNo: ++i });
  while (j < m) ops.push({ kind: '+', line: localLines[j++] });

  return ops;
}

const CONTEXT_LINES = 3;

function printDiff(liveText, localText) {
  const live = normalize(liveText).split('\n');
  const local = normalize(localText).split('\n');
  const ops = diffLines(live, local);

  const changedIdx = ops.reduce((acc, op, idx) => (op.kind === ' ' ? acc : [...acc, idx]), []);
  if (!changedIdx.length) {
    console.log('    (idêntico ao que está no ar)');
    return { changed: false, removed: 0, added: 0 };
  }

  // Mostra só as vizinhanças das mudanças, com "..." entre trechos distantes.
  const keep = new Set();
  for (const idx of changedIdx) {
    for (let k = idx - CONTEXT_LINES; k <= idx + CONTEXT_LINES; k++) {
      if (k >= 0 && k < ops.length) keep.add(k);
    }
  }

  let previous = -1;
  for (let idx = 0; idx < ops.length; idx++) {
    if (!keep.has(idx)) continue;
    if (previous !== -1 && idx > previous + 1) console.log('    ...');
    const op = ops[idx];
    const lineNo = op.liveNo ? String(op.liveNo).padStart(4) : '    ';
    console.log(`    ${lineNo} ${op.kind} ${op.line}`);
    previous = idx;
  }

  const removed = changedIdx.filter((idx) => ops[idx].kind === '-').length;
  const added = changedIdx.filter((idx) => ops[idx].kind === '+').length;
  console.log(`    → ${removed} linha(s) removida(s) do ar, ${added} adicionada(s)`);
  if (removed > 0) {
    console.log('    ⚠️  Há linhas SAINDO do ar. Confirme que nenhuma é uma proteção.');
  }
  return { changed: true, removed, added };
}

/** Cache da listagem: os dois alvos compartilham a mesma chamada. */
let releasesCache = null;

async function findRelease(target) {
  if (!releasesCache) {
    const listed = await api(`projects/${PROJECT_ID}/releases`);
    releasesCache = listed.releases ?? [];
  }
  const match = releasesCache.filter((r) => target.matches(r.name));
  if (match.length === 0) {
    throw new Error(
      `nenhum release encontrado para ${target.describe}. ` +
        `Releases existentes: ${releasesCache.map((r) => r.name.split('/releases/')[1]).join(', ') || '(nenhum)'}`
    );
  }
  if (match.length > 1) {
    throw new Error(
      `${match.length} releases casaram com ${target.describe} — ambíguo, abortando: ` +
        match.map((r) => r.name.split('/releases/')[1]).join(', ')
    );
  }
  return match[0];
}

async function deployTarget(name) {
  const target = TARGETS[name];
  const { file } = target;
  console.log(`\n=== ${name} (${file} -> ${target.describe}) ===`);

  const release = await findRelease(target);
  const releasePath = release.name;
  console.log(`  release: ${releasePath.split('/releases/')[1]}`);
  const currentRuleset = release.rulesetName.split('/').pop();
  console.log(`  ruleset atual (use para rollback): ${currentRuleset}`);

  if (ROLLBACK_RULESET) {
    console.log(`  rollback solicitado para: ${ROLLBACK_RULESET}`);
    if (!APPLY) {
      console.log('  (dry-run: nada publicado)');
      return;
    }
    const rolled = await api(releasePath, {
      method: 'PATCH',
      body: JSON.stringify({
        release: { name: releasePath, rulesetName: `projects/${PROJECT_ID}/rulesets/${ROLLBACK_RULESET}` },
      }),
    });
    console.log(`  ✅ release revertido para ${rolled.rulesetName.split('/').pop()}`);
    return;
  }

  const liveRuleset = await api(release.rulesetName);
  const liveSource = liveRuleset.source.files[0].content;
  const localSource = readFileSync(file, 'utf8');

  console.log('  diff (no ar -> local):');
  const { changed } = printDiff(liveSource, localSource);
  if (!changed) {
    console.log('  nada a publicar.');
    return;
  }

  if (!APPLY) {
    console.log('  (dry-run: nada publicado — repita com --apply)');
    return;
  }

  // createRuleset valida a sintaxe; se falhar, nada entra no ar.
  const created = await api(`projects/${PROJECT_ID}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({ source: { files: [{ name: file, content: localSource }] } }),
  });
  const newRuleset = created.name.split('/').pop();
  console.log(`  ruleset criado e validado: ${newRuleset}`);

  const updated = await api(releasePath, {
    method: 'PATCH',
    body: JSON.stringify({ release: { name: releasePath, rulesetName: created.name } }),
  });
  console.log(`  ✅ publicado: ${updated.rulesetName.split('/').pop()} @ ${updated.updateTime}`);
  console.log(`     rollback: --only=${name} --rollback=${currentRuleset} --apply`);
}

async function run() {
  if (!PROJECT_ID) throw new Error('FIREBASE_ADMIN_PROJECT_ID ausente. Use --env-file=.env.local');

  console.log(`Projeto: ${PROJECT_ID}`);
  console.log(APPLY ? 'Modo: APPLY (vai publicar)' : 'Modo: dry-run');

  const targets = ONLY === 'both' ? ['firestore', 'storage'] : [ONLY];
  for (const target of targets) {
    await deployTarget(target);
  }
}

run()
  .then(() => {
    console.log(`\n=== CONCLUÍDO (sem erros) ===`);
    console.log(`log salvo em ${LOG_PATH}`);
  })
  .catch((err) => {
    console.error(`\n❌ ${err.message}`);
    console.error(`=== CONCLUÍDO (com erro) ===`);
    console.error(`log salvo em ${LOG_PATH}`);
    process.exitCode = 1;
  });

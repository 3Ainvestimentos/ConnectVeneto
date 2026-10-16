/**
 * Grava dois avisos Importantes no canal Institucional do feed (`hubPosts`), assinados por
 * "Comunicação Vêneto": o prazo da Declaração de Investimentos Pessoais e o Kickoff do semestre.
 * Ids fixos: rodar de novo ATUALIZA o conteúdo e preserva reações, presença e contadores.
 *
 * Os dados do Kickoff (data, horário, local) são de teste; dá para ajustar aqui e rodar de novo,
 * ou tirar do destaque/arquivar pela tela.
 *
 * Usage:
 *   node --env-file=.env.local scripts/hub-seed-avisos.mjs
 *   node --env-file=.env.local scripts/hub-seed-avisos.mjs --apply
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const AUTHOR = { email: 'comunicacao@venetomfo.com.br', name: 'Comunicação Vêneto', position: 'RH e Comunicação' };
/** Horário de Brasília. */
const br = (local) => new Date(`${local}-03:00`).toISOString();

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

const AVISOS = [
  {
    id: 'aviso-declaracao-2026',
    title: 'Declaração de Investimentos Pessoais: prazo até 31/10',
    body:
      'Está aberto o preenchimento anual da Declaração de Investimentos Pessoais. Todos os colaboradores precisam enviar até 31/10/2026.\n\n' +
      'O envio é feito por uma solicitação no TrackFlow. Dúvidas sobre o que declarar: fale com o Compliance.',
    buttons: [{ label: 'Abrir solicitação', href: '/trackflow' }],
    highlightUntil: br('2026-10-31T23:59:00'),
    expiresAt: br('2026-11-01T00:00:00'),
  },
  {
    id: 'aviso-kickoff-2026-2',
    title: 'Kickoff do 2º semestre: alinhamento de toda a Vêneto',
    body:
      'Vamos nos reunir para fechar o semestre e alinhar o próximo: resultados, prioridades de cada área e o que muda para o time. ' +
      'Depois, almoço com todo mundo.\n\nConfirme sua presença aqui no post para ajudarmos na organização.',
    buttons: [],
    event: { start: br('2026-11-05T09:00:00'), end: br('2026-11-05T13:00:00'), place: 'Espaço Villa Lobos, São Paulo', audience: 'Interno' },
    highlightUntil: br('2026-11-05T23:59:00'),
    expiresAt: br('2026-11-06T00:00:00'),
  },
];

const now = new Date().toISOString();
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — ${AVISOS.length} avisos em hubPosts (canal institucional)`);

const writes = [];
for (const a of AVISOS) {
  const ref = db.collection('hubPosts').doc(a.id);
  const snap = await ref.get();
  const content = {
    id: a.id,
    channelId: 'institucional',
    authorEmail: AUTHOR.email,
    authorName: AUTHOR.name,
    authorPosition: AUTHOR.position,
    title: a.title,
    body: a.body,
    importance: 'importante',
    highlightUntil: a.highlightUntil,
    expiresAt: a.expiresAt,
    images: [],
    files: [],
    buttons: a.buttons,
    ...(a.event ? { event: a.event } : {}),
    status: 'published',
    source: 'hub',
    updatedAt: now,
  };
  if (snap.exists) {
    writes.push([ref, content]);
    console.log(`  ~ atualiza ${a.id} — ${a.title}`);
  } else {
    writes.push([
      ref,
      { ...content, createdAt: now, commentCount: 0, relevantCommentCount: 0, reactionCounts: {}, rsvpCounts: { vou: 0, talvez: 0, nao: 0 }, pollCounts: [] },
    ]);
    console.log(`  + cria ${a.id} — ${a.title}`);
  }
  console.log(`      destaque até ${a.highlightUntil} · expira ${a.expiresAt}${a.event ? ` · evento ${a.event.start}–${a.event.end} @ ${a.event.place}` : ''}`);
}

if (!APPLY) {
  console.log('\nNada gravado (dry-run). Rode com --apply para gravar.');
  process.exit(0);
}
const batch = db.batch();
for (const [ref, data] of writes) batch.set(ref, data, { merge: true });
await batch.commit();
console.log('\nOK: gravado em hubPosts.');

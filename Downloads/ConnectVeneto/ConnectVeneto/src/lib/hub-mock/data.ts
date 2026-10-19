import type { Channel, Indicator, Person, Post, Trip, UpcomingEvent, Vacation } from './types';

/** Datas relativas a hoje, para o mock nunca parecer velho. */
const DAY = 24 * 60 * 60 * 1000;
export const daysFromNow = (days: number, hour = 9) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

/** Unidades da Vêneto — opções de destino de uma Viagem. */
export const UNITS = ['São Paulo', 'Belo Horizonte', 'Curitiba', 'Rio de Janeiro'];

/** Id do colaborador que o wireframe simula como "você". */
export const ME_ID = 'rafael';
/** Equipe de Comunicação publica em qualquer canal. */
export const COMMUNICATION_IDS = ['camila', 'beatriz'];

export const PEOPLE: Person[] = [
  { id: 'ana', name: 'Ana Ribeiro', initials: 'AR', position: 'CEO', area: 'Diretoria', axis: 'Diretoria', city: 'São Paulo', managerId: null, color: 'slate' },
  { id: 'marcos', name: 'Marcos Tavares', initials: 'MT', position: 'Diretor de Investimentos', area: 'Investimentos', axis: 'Investimentos', city: 'São Paulo', managerId: 'ana', team: 'Diretoria', color: 'sky' },
  { id: 'pedro', name: 'Pedro Almeida', initials: 'PA', position: 'Diretor Comercial', area: 'Comercial', axis: 'Comercial', city: 'São Paulo', managerId: 'ana', team: 'Diretoria', color: 'teal' },
  {
    id: 'carla', name: 'Carla Mendes', initials: 'CM', position: 'Head de Tecnologia', area: 'Tecnologia', axis: 'Operações', city: 'São Paulo', managerId: 'ana', team: 'Diretoria', color: 'amber',
    since: '2019-03-01',
    bio: 'Cuido para que o Connect, o TrackFlow e as integrações funcionem sem ninguém precisar pensar nisso.',
    responsibilities: ['Connect Vêneto', 'TrackFlow', 'Integrações', 'Segurança de acesso', 'Dados'],
    interests: ['corrida', 'fotografia', 'cafés especiais', 'xadrez'],
    phone: '(11) 98765-4321',
    chat: 'carla.mendes@venetomfo.com.br',
    history: [
      { position: 'Head de Tecnologia', period: 'jan/2024 · atual' },
      { position: 'Coordenadora de Tecnologia', period: 'jul/2021 a dez/2023' },
      { position: 'Analista de Sistemas Sr', period: 'mar/2019 a jun/2021' },
    ],
  },
  { id: 'fernanda', name: 'Fernanda Costa', initials: 'FC', position: 'Head de Compliance', area: 'Compliance', axis: 'Operações', city: 'São Paulo', managerId: 'ana', team: 'Diretoria', color: 'violet' },
  { id: 'renata', name: 'Renata Dias', initials: 'RD', position: 'Head de Pessoas', area: 'Pessoas', axis: 'Pessoas', city: 'São Paulo', managerId: 'ana', team: 'Diretoria', color: 'rose' },
  { id: 'gustavo', name: 'Gustavo Reis', initials: 'GR', position: 'Analista de Investimentos', area: 'Investimentos', axis: 'Investimentos', city: 'São Paulo', managerId: 'marcos', team: 'Gestão de Carteiras', color: 'sky' },
  { id: 'helena', name: 'Helena Barros', initials: 'HB', position: 'Analista de Research', area: 'Investimentos', axis: 'Investimentos', city: 'São Paulo', managerId: 'marcos', team: 'Research', color: 'sky' },
  { id: 'juliana', name: 'Juliana Prado', initials: 'JP', position: 'Gestora de Relacionamento', area: 'Comercial', axis: 'Comercial', city: 'Belo Horizonte', managerId: 'pedro', team: 'Relacionamento', color: 'teal' },
  { id: 'lucas', name: 'Lucas Martins', initials: 'LM', position: 'Assessor de Investimentos', area: 'Comercial', axis: 'Comercial', city: 'Curitiba', managerId: 'pedro', team: 'Relacionamento', color: 'teal' },
  { id: 'paula', name: 'Paula Reis', initials: 'PR', position: 'Assessora de Investimentos', area: 'Comercial', axis: 'Comercial', city: 'São Paulo', managerId: 'pedro', team: 'Relacionamento', color: 'teal' },
  { id: 'camila', name: 'Camila Rocha', initials: 'CR', position: 'Coordenadora de Marketing', area: 'Marketing', axis: 'Comercial', city: 'São Paulo', managerId: 'pedro', team: 'Marketing', color: 'rose' },
  { id: 'rafael', name: 'Rafael Nunes', initials: 'RN', position: 'Analista de Tecnologia', area: 'Tecnologia', axis: 'Operações', city: 'São Paulo', managerId: 'carla', team: 'Plataforma Connect', color: 'amber' },
  { id: 'marina', name: 'Marina Lopes', initials: 'ML', position: 'Desenvolvedora Front-end', area: 'Tecnologia', axis: 'Operações', city: 'São Paulo', managerId: 'carla', team: 'Plataforma Connect', color: 'amber' },
  { id: 'thiago', name: 'Thiago Souza', initials: 'TS', position: 'Analista de Dados', area: 'Tecnologia', axis: 'Operações', city: 'Belo Horizonte', managerId: 'carla', team: 'Dados', color: 'amber' },
  { id: 'diego', name: 'Diego Faria', initials: 'DF', position: 'Engenheiro de Dados', area: 'Tecnologia', axis: 'Operações', city: 'São Paulo', managerId: 'carla', team: 'Dados', color: 'amber' },
  { id: 'beatriz', name: 'Beatriz Lima', initials: 'BL', position: 'Analista de RH', area: 'Pessoas', axis: 'Pessoas', city: 'São Paulo', managerId: 'renata', team: 'RH', color: 'rose' },
];

/** Autores institucionais (não entram no organograma). */
export const SYSTEM_PEOPLE: Person[] = [
  { id: 'comunicacao', name: 'Comunicação Vêneto', initials: 'CV', position: 'RH e Comunicação', area: 'Pessoas', axis: 'Pessoas', city: 'São Paulo', managerId: null, color: 'slate' },
];

export const CHANNELS: Channel[] = [
  { id: 'institucional', name: 'Institucional', ownerId: 'camila', publisherIds: ['ana', 'renata'], seeded: true },
  { id: 'tecnologia', name: 'Tecnologia', ownerId: 'carla', publisherIds: ['carla', 'rafael', 'thiago'], seeded: true },
  { id: 'eventos', name: 'Eventos', ownerId: 'camila', publisherIds: ['juliana'], seeded: true },
  { id: 'mercado', name: 'Mercado', ownerId: 'marcos', publisherIds: ['marcos', 'gustavo', 'helena'], seeded: true },
  { id: 'vagas', name: 'Vagas e indicações', ownerId: 'beatriz', publisherIds: ['renata'], seeded: true },
  { id: 'compliance', name: 'Compliance', ownerId: 'fernanda', publisherIds: ['fernanda'], seeded: true },
  { id: 'bem-estar', name: 'Bem-estar', ownerId: 'renata', publisherIds: ['renata'], seeded: false },
];

export const INITIAL_POSTS: Post[] = [
  {
    id: 'p1', channelId: 'compliance', authorId: 'fernanda', createdAt: hoursAgo(2), importance: 'importante', highlightUntil: daysFromNow(7, 23),
    title: 'Nova política de senhas entra em vigor dia 15',
    body: 'A partir do dia 15 o acesso ao Connect e aos sistemas da Vêneto exige autenticação em duas etapas. Configure até lá para não perder o acesso. O passo a passo está na Biblioteca.',
    link: { label: 'Abrir o passo a passo', href: '/documents' },
    reactions: { '👍': 31, '💡': 6 },
    comments: [
      { id: 'c11', authorId: 'paula', text: 'Funciona com o autenticador da Microsoft ou só com o do Google?', createdAt: hoursAgo(1.5), relevant: true },
      { id: 'c12', authorId: 'fernanda', text: 'Funciona com os dois, e também com o 1Password.', createdAt: hoursAgo(1.2), relevant: true },
      { id: 'c13', authorId: 'lucas', text: 'Configurei aqui, foi rápido.', createdAt: hoursAgo(1), relevant: false },
    ],
  },
  {
    id: 'p2', channelId: 'eventos', authorId: 'camila', createdAt: hoursAgo(26), importance: 'importante', highlightUntil: daysFromNow(9, 23), expiresAt: daysFromNow(10, 23),
    title: 'Vêneto Day 2026: confirme sua presença',
    body: 'Um dia inteiro para a gente se encontrar, ouvir os resultados do ano e celebrar. Almoço incluso, dress code casual. Confirme até sexta para fecharmos o buffet.',
    cover: 'Vêneto Day · Espaço Villa Lobos',
    event: { date: daysFromNow(10), place: 'Espaço Villa Lobos, São Paulo · 9h às 18h', audience: 'Interno', going: 48 },
    reactions: { '🎉': 42, '❤️': 17, '👏': 9 },
    comments: [
      { id: 'c21', authorId: 'thiago', text: 'Vai ter transporte saindo de BH?', createdAt: hoursAgo(20), relevant: true },
      { id: 'c22', authorId: 'camila', text: 'Vai sim! Van saindo da unidade às 6h. Confirme no formulário.', createdAt: hoursAgo(19), relevant: true },
      { id: 'c23', authorId: 'diego', text: 'Bora!', createdAt: hoursAgo(18), relevant: false },
    ],
  },
  {
    id: 'p3', channelId: 'tecnologia', authorId: 'rafael', createdAt: hoursAgo(5), importance: 'normal',
    title: 'Migramos o Connect para o Next 15: o que muda para você',
    body: 'A navegação entre módulos ficou mais rápida e o login no TrackFlow embarcado parou de pedir senha no iPhone. Se encontrar algo estranho, comente aqui.',
    reactions: { '👍': 18, '👏': 7, '💡': 3 },
    comments: [
      { id: 'c31', authorId: 'juliana', text: 'Muito melhor no celular, parabéns!', createdAt: hoursAgo(4), relevant: false },
      { id: 'c32', authorId: 'thiago', text: 'O dashboard de dados também ficou mais rápido com isso.', createdAt: hoursAgo(3), relevant: true },
    ],
  },
  {
    id: 'p4', channelId: 'eventos', authorId: 'juliana', createdAt: hoursAgo(7), importance: 'normal', expiresAt: daysFromNow(4, 23),
    title: 'Café com Investidores em Belo Horizonte',
    body: 'Encontro com 20 clientes da unidade BH para falar de cenário macro e alocação. Quem da equipe de Investimentos pode vir? O convite para os clientes está anexo.',
    event: { date: daysFromNow(4, 8), place: 'Unidade BH · 8h30', audience: 'Clientes', going: 6, material: 'convite-cafe-investidores-bh.pdf' },
    reactions: { '👍': 9, '❤️': 2 },
    comments: [{ id: 'c41', authorId: 'helena', text: 'Posso ir e levar o material de research do mês.', createdAt: hoursAgo(6), relevant: false }],
  },
  {
    id: 'p5', channelId: 'mercado', authorId: 'gustavo', createdAt: hoursAgo(20), importance: 'normal',
    title: 'Resumo do Copom em 5 linhas',
    body: 'Selic mantida. O comunicado veio mais duro que o esperado e o mercado passou a precificar cortes só a partir do segundo trimestre. @Marcos Tavares detalha no call de quinta.',
    reactions: { '💡': 12, '👍': 5 },
    comments: [],
  },
  {
    id: 'p6', channelId: 'institucional', authorId: 'renata', createdAt: hoursAgo(30), importance: 'normal',
    title: 'Qual o melhor horário para o próximo all-hands?',
    body: 'Queremos um horário que funcione para as quatro unidades. Vote até sexta:',
    poll: { options: [{ label: 'Terça às 9h', votes: 21 }, { label: 'Quinta às 17h', votes: 14 }, { label: 'Sexta às 11h', votes: 6 }], closesAt: daysFromNow(2) },
    reactions: { '👍': 8 },
    comments: [],
  },
  {
    id: 'p7', channelId: 'vagas', authorId: 'renata', createdAt: hoursAgo(50), importance: 'normal',
    title: 'Indique: Analista de Operações Jr',
    body: 'Vaga nova no time de Operações em São Paulo. Indicações de colaboradores têm prioridade na triagem.',
    link: { label: 'Ver vaga e indicar', href: '#' },
    reactions: { '👍': 6 },
    comments: [],
  },
];

export const INITIAL_TRIPS: Trip[] = [
  { id: 't1', personId: 'thiago', destination: 'São Paulo', start: daysFromNow(5), end: daysFromNow(7), purpose: 'Planejamento de dados 2027' },
  { id: 't2', personId: 'pedro', destination: 'Belo Horizonte', start: daysFromNow(4), end: daysFromNow(6), purpose: 'Café com Investidores' },
  { id: 't3', personId: 'carla', destination: 'Curitiba', start: daysFromNow(7), end: daysFromNow(7) },
  { id: 't4', personId: 'rafael', destination: 'Belo Horizonte', start: daysFromNow(20), end: daysFromNow(21), purpose: 'Treinamento do Connect na unidade' },
];

export const INITIAL_VACATIONS: Vacation[] = [
  { id: 'v1', personId: 'juliana', start: daysFromNow(-3), end: daysFromNow(10), status: 'approved', approverId: 'pedro' },
  { id: 'v2', personId: 'lucas', start: daysFromNow(-8), end: daysFromNow(6), status: 'approved', approverId: 'pedro' },
  { id: 'v3', personId: 'diego', start: daysFromNow(12), end: daysFromNow(26), status: 'approved', approverId: 'carla' },
  { id: 'v4', personId: 'rafael', start: daysFromNow(45), end: daysFromNow(59), status: 'pending', approverId: 'carla' },
];

export const UPCOMING_EVENTS: UpcomingEvent[] = [
  { id: 'e1', title: 'Happy hour do time Tech', date: daysFromNow(2, 18), audience: 'Interno' },
  { id: 'e2', title: 'Café com Investidores · BH', date: daysFromNow(4, 8), audience: 'Clientes', postId: 'p4' },
  { id: 'e3', title: 'Vêneto Day 2026', date: daysFromNow(10), audience: 'Interno', postId: 'p2' },
];

export const BIRTHDAYS: { personId: string; date: string }[] = [
  { personId: 'camila', date: daysFromNow(0) },
  { personId: 'thiago', date: daysFromNow(3) },
  { personId: 'marcos', date: daysFromNow(6) },
];

export const STRATEGIC_INDICATORS: Indicator[] = [
  { label: 'AUM', hint: 'patrimônio sob gestão', value: 'R$ 4,82 bi', delta: '+2,1% no mês', trend: 'up', tone: 'positive' },
  { label: 'Churn', hint: '12 meses', value: '1,9%', delta: '−0,3 p.p. vs. ano anterior', trend: 'down', tone: 'positive' },
  { label: 'ROA', hint: 'trimestre', value: '0,62%', delta: 'estável', trend: 'flat', tone: 'neutral' },
];

export const REACTIONS = ['👍', '❤️', '👏', '💡', '🎉'];

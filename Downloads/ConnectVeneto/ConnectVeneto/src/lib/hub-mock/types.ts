/**
 * Tipos do wireframe do Hub de Comunicação (nova Home).
 * Vocabulário segue o CONTEXT.md: Canal, Publicação, Publicador, Importante, Período de destaque,
 * Comentário relevante, Viagem, Férias, Equipe.
 */

export type Importance = 'normal' | 'importante';

/** Tom do avatar (as classes reais ficam em PersonAvatar, onde o Tailwind as enxerga). */
export type AvatarTone = 'slate' | 'sky' | 'teal' | 'amber' | 'violet' | 'rose';

export interface Person {
  id: string;
  name: string;
  initials: string;
  position: string;
  area: string;
  axis: string;
  city: string;
  team?: string;
  managerId: string | null;
  color: AvatarTone;
  since?: string;
  bio?: string;
  responsibilities?: string[];
  interests?: string[];
  phone?: string;
  history?: { position: string; period: string }[];
  /** Endereço no Google Chat (normalmente o e-mail). */
  chat?: string;
}

/** Campos do Perfil que a própria pessoa edita. */
export type PersonalProfile = Pick<Person, 'bio' | 'responsibilities' | 'interests' | 'phone' | 'chat'>;

export interface Channel {
  id: string;
  name: string;
  ownerId: string;
  /** Quem pode publicar neste canal, além da Comunicação. */
  publisherIds: string[];
  seeded: boolean;
}

export interface PostComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
  /** Só comentários marcados pelo autor da publicação ficam visíveis para todos. */
  relevant: boolean;
}

export interface PostEvent {
  date: string;
  /** Término (opcional). Sem ele, o evento dura 1h ao ir para o Google Agenda. */
  end?: string;
  place: string;
  audience: 'Interno' | 'Clientes';
  going: number;
  material?: string;
  /** Evento importado do Google Agenda da Vêneto (id do evento no calendário). */
  calendarEventId?: string;
}

export interface PostImage {
  url: string;
  name?: string;
}

/** Vídeo enviado (Storage) ou link do YouTube/Drive. */
export interface PostVideo {
  url: string;
  kind: 'upload' | 'youtube' | 'drive' | 'link';
  name?: string;
}

export interface PostFile {
  url: string;
  name: string;
  size?: number;
}

export interface PostButton {
  label: string;
  href: string;
}

export interface PostPoll {
  options: { label: string; votes: number }[];
  closesAt: string;
}

export interface Post {
  id: string;
  channelId: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: string;
  importance: Importance;
  /** Até quando uma publicação Importante fica fixada no topo. */
  highlightUntil?: string;
  /** Data a partir da qual a publicação sai do feed. */
  expiresAt?: string;
  /** Texto da capa (mock) ou URL de imagem real. */
  cover?: string;
  coverUrl?: string;
  link?: { label: string; href: string };
  images?: PostImage[];
  video?: PostVideo;
  files?: PostFile[];
  /** Botões de ação com link (ex.: "Inscreva-se", "Abrir formulário"). */
  buttons?: PostButton[];
  /** Publicação vinda de outra fonte do Connect (ex.: Notícias do RH). */
  source?: 'news';
  event?: PostEvent;
  poll?: PostPoll;
  reactions: Record<string, number>;
  comments: PostComment[];
}

export interface Trip {
  id: string;
  personId: string;
  destination: string;
  start: string;
  end: string;
  purpose?: string;
}

export type VacationStatus = 'pending' | 'approved' | 'rejected';

export interface Vacation {
  id: string;
  personId: string;
  start: string;
  end: string;
  status: VacationStatus;
  approverId: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  audience: 'Interno' | 'Clientes';
  postId?: string;
}

export interface Indicator {
  label: string;
  /** Período ou referência curta (ex.: "12 meses", "hoje"). */
  hint?: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  /** Leitura da variação para quem olha: boa, ruim ou neutra. */
  tone: 'positive' | 'negative' | 'neutral';
}

/** Perfil de visualização do wireframe — simula permissões para validar com o time. */
export type ViewerRole = 'colaborador' | 'publicador';

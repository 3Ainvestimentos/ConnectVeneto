"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Lock, Mail, MessageCircle, Pencil, Phone, Plane, TreePalm } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditProfileDialog } from '@/components/hub-feed/EditProfileDialog';
import { HubBreadcrumb, HubPage } from '@/components/hub-feed/HubPage';
import { MyAgenda } from '@/components/hub-feed/MyAgenda';
import { PersonAvatar } from '@/components/hub-feed/PersonAvatar';
import { timeAgo } from '@/components/hub-feed/format';
import { useHubFeed } from '@/hooks/useHubFeed';
import { useApprovedVacations, useHubPeople, useHubTrips } from '@/hooks/useHubPeople';
import { normalizeEmail } from '@/lib/email-utils';
import { parseLocalDate, teamsOf } from '@/lib/hub/people';
import { unitPathLabel } from '@/lib/hub/org-units';
import { useOrgUnits } from '@/hooks/useOrgUnits';

const Box = ({ title, badge, children, id }: { title: string; badge?: React.ReactNode; children: React.ReactNode; id?: string }) => (
  <section id={id} className="grid gap-5 rounded-xl border bg-card p-6 shadow-sm">
    <h2 className="flex flex-wrap items-center gap-2 font-headline text-lg font-bold">
      {title}
      {badge}
    </h2>
    {children}
  </section>
);

const Official = () => (
  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
    <Lock className="h-3 w-3" /> mantido pelo RH
  </span>
);
const Personal = () => (
  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
    <Pencil className="h-3 w-3" /> editado pela pessoa
  </span>
);

const dm = (iso: string) => parseLocalDate(iso)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) ?? '';
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function PerfilPage() {
  const { id } = useParams<{ id: string }>();
  const { people, byId, me, loading } = useHubPeople();
  const { trips } = useHubTrips();
  const { vacations } = useApprovedVacations();
  const { data: feed } = useHubFeed();
  const { byId: unitsById } = useOrgUnits();
  const [editOpen, setEditOpen] = useState(false);
  const person = byId.get(id);

  if (!person) {
    return (
      <HubPage>
        <HubBreadcrumb items={[{ label: 'Pessoas e equipes', href: '/pessoas' }, { label: loading ? 'Carregando…' : 'Não encontrado' }]} />
        {!loading && <p className="text-muted-foreground">Pessoa não encontrada.</p>}
      </HubPage>
    );
  }

  const isMe = person.id === me?.id;
  const manager = person.managerId ? byId.get(person.managerId) ?? null : null;
  const teams = teamsOf(people, person.id);
  const today = todayIso();
  const nextTrip = trips.filter((t) => t.person?.id === person.id && t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const vacationNow = vacations.find((v) => v.person?.id === person.id && v.startDate <= today && v.endDate >= today);
  const target = normalizeEmail(person.email);
  const posts = (feed?.posts ?? [])
    .filter((p) => normalizeEmail(p.authorEmail) === target)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const channelName = (cid: string) => feed?.channels.find((c) => c.id === cid)?.name ?? '';
  const chat = person.chat ?? person.email;
  // Google Chat não tem link direto por e-mail; abre o Chat e a pessoa busca o nome.
  const chatHref = 'https://chat.google.com/';
  const since = parseLocalDate(person.since);

  return (
    <HubPage>
      <HubBreadcrumb items={[{ label: 'Pessoas e equipes', href: '/pessoas' }, { label: person.name }]} />

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="h-20 bg-gradient-to-r from-slate-800 via-slate-700 to-primary sm:h-28" />
        <div className="flex flex-wrap items-end gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <PersonAvatar person={person} size="xl" className="-mt-10 border-4 border-card sm:-mt-12" />
          <div className="min-w-[200px] flex-1">
            <h1 className="font-headline text-2xl font-bold">{person.name}</h1>
            <p className="text-base text-muted-foreground">{[person.position, person.team ?? person.area, person.city].filter(Boolean).join(' · ')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {vacationNow && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <TreePalm className="h-3.5 w-3.5" /> De férias até {dm(vacationNow.endDate)}
                </span>
              )}
              {nextTrip && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  <Plane className="h-3.5 w-3.5" /> Em {nextTrip.destinationBranch.split(' - ')[0]} · {dm(nextTrip.startDate)} a {dm(nextTrip.endDate)}
                </span>
              )}
            </div>
          </div>
          {isMe ? (
            <Button onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar meu perfil
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <a href={chatHref} target="_blank" rel="noopener noreferrer" title="Abre o Google Chat em outra aba">
                <MessageCircle className="mr-2 h-4 w-4" /> Conversar no Google Chat
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-6">
          <Box title="Sobre" badge={<Personal />}>
            {person.bio ? (
              <p className="whitespace-pre-line text-base">{person.bio}</p>
            ) : isMe ? (
              <button type="button" onClick={() => setEditOpen(true)} className="rounded-lg border border-dashed p-3 text-left text-base text-muted-foreground hover:bg-muted">
                Conte em uma frase o que você faz e no que pode ajudar. Clique para escrever.
              </button>
            ) : (
              <p className="text-base text-muted-foreground">{person.name.split(' ')[0]} ainda não escreveu sobre si.</p>
            )}
            {person.responsibilities.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">No que trabalho</div>
                <div className="flex flex-wrap gap-1.5">
                  {person.responsibilities.map((r) => (
                    <span key={r} className="rounded-full border px-2.5 py-0.5 text-sm">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {person.interests.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Interesses</div>
                <div className="flex flex-wrap gap-1.5">
                  {person.interests.map((r) => (
                    <span key={r} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Box>

          {teams.length > 0 && (
            <Box title={`Lidera ${teams.length > 1 ? `${teams.length} equipes` : teams[0].team === 'Sem equipe' ? `${teams[0].members.length} pessoas` : teams[0].team}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {teams.map(({ team, members }) => (
                  <div key={team} className="rounded-lg border p-3">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">{team}</div>
                    <div className="grid gap-1.5">
                      {members.map((m) => (
                        <Link key={m.id} href={`/pessoas/${m.id}`} className="flex items-center gap-2 text-base hover:underline">
                          <PersonAvatar person={m} size="xs" />
                          {m.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Box>
          )}

          {isMe && <MyAgenda />}

          <Box title="Publicações">
            {posts.length === 0 ? (
              <p className="text-base text-muted-foreground">{person.name.split(' ')[0]} ainda não publicou nada.</p>
            ) : (
              <ul className="grid gap-1.5">
                {posts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/publicacoes?p=${p.id}`} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-base hover:bg-muted">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {channelName(p.channelId)} · {timeAgo(p.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">{Object.values(p.reactionCounts ?? {}).reduce((a, b) => a + b, 0)} reações</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Box>
        </div>

        <div className="grid content-start gap-6">
          <Box title="Dados oficiais" badge={<Official />}>
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-base">
              <dt className="text-muted-foreground">Cargo</dt>
              <dd>{person.position || '—'}</dd>
              <dt className="text-muted-foreground">Área</dt>
              <dd>{person.area || '—'}</dd>
              <dt className="text-muted-foreground">Equipe</dt>
              <dd>{person.unitId ? unitPathLabel(unitsById, person.unitId) : person.team ?? '—'}</dd>
              <dt className="text-muted-foreground">Eixo</dt>
              <dd>{person.axis || '—'}</dd>
              <dt className="text-muted-foreground">Unidade</dt>
              <dd>{person.city || '—'}</dd>
              <dt className="text-muted-foreground">Reporta a</dt>
              <dd>
                {manager ? (
                  <Link href={`/pessoas/${manager.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <PersonAvatar person={manager} size="xs" /> {manager.name}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
              {since && (
                <>
                  <dt className="text-muted-foreground">Na Vêneto desde</dt>
                  <dd>{since.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</dd>
                </>
              )}
            </dl>
          </Box>

          {person.history.length > 0 && (
            <Box title="Histórico de cargos" badge={<Official />}>
              <ol className="ml-1.5 grid border-l-2 pl-4">
                {person.history.map((h, i) => (
                  <li key={`${h.position}-${i}`} className="relative pb-3 text-base last:pb-0">
                    <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-primary ${i === 0 ? 'bg-primary' : 'bg-card'}`} />
                    <div className="font-medium">{h.position}</div>
                    {h.period && <div className="text-sm text-muted-foreground">{h.period}</div>}
                  </li>
                ))}
              </ol>
            </Box>
          )}

          <Box title="Contato" badge={<Personal />}>
            <dl className="grid gap-2.5 text-base">
              {(
                [
                  [Mail, 'E-mail', person.email],
                  [MessageCircle, 'Google Chat', chat],
                  ...(person.phone ? [[Phone, 'Telefone / WhatsApp', person.phone] as const] : []),
                ] as const
              ).map(([Icon, label, value]) => (
                <div key={label} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
                    <dd className="select-all break-all">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Box>
        </div>
      </div>
      {isMe && <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} person={person} />}
    </HubPage>
  );
}

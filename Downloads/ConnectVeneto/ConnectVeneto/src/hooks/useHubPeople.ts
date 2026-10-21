"use client";

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { useTripsBirthdays, type LeaderTripType } from '@/contexts/TripsBirthdaysContext';
import { normalizeEmail } from '@/lib/email-utils';
import { buildPeople, normalizeName, type HubPerson, type HubVacationItem } from '@/lib/hub/people';

/** Pessoas do Hub (cadastro de colaboradores) + quem é a pessoa logada. */
export function useHubPeople() {
  const { user } = useAuth();
  const { collaborators, loading } = useCollaborators();
  return useMemo(() => {
    const people = buildPeople(collaborators);
    const byId = new Map(people.map((p) => [p.id, p]));
    const byAuthUid = new Map(people.filter((p) => p.authUid).map((p) => [p.authUid!, p]));
    const byName = new Map(people.map((p) => [normalizeName(p.name), p]));
    const target = normalizeEmail(user?.email);
    const me = (user && byAuthUid.get(user.uid)) || people.find((p) => normalizeEmail(p.email) === target) || null;
    return { people, byId, byAuthUid, byName, me, loading };
  }, [collaborators, user, loading]);
}

export interface HubTrip extends LeaderTripType {
  /** Pessoa que viaja: pelo nome (`leaderName`) ou, se não achar, por quem registrou. */
  person: HubPerson | null;
}

/** Viagens (`leaderTrips`) com a pessoa resolvida. */
export function useHubTrips() {
  const { trips, loading } = useTripsBirthdays();
  const { byName, byAuthUid } = useHubPeople();
  const items = useMemo<HubTrip[]>(
    () => trips.map((t) => ({ ...t, person: byName.get(normalizeName(t.leaderName)) ?? byAuthUid.get(t.responsavelUid) ?? null })),
    [trips, byName, byAuthUid],
  );
  return { trips: items, loading };
}

export interface HubVacation extends HubVacationItem {
  person: HubPerson | null;
}

/**
 * Férias aprovadas de todo mundo nos próximos 60 dias, lidas pelo servidor (`/api/feed/vacations`):
 * o registro oficial (`vacations`) não é legível pelo navegador de quem não é o dono.
 */
export function useApprovedVacations() {
  const { user } = useAuth();
  const { byAuthUid } = useHubPeople();
  const query = useQuery({
    queryKey: ['hub-vacations'],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<HubVacationItem[]> => {
      const token = await user?.getIdToken();
      const res = await fetch('/api/feed/vacations', { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      if (!res.ok) return [];
      const body = await res.json().catch(() => ({}));
      return Array.isArray(body.vacations) ? body.vacations : [];
    },
  });
  const vacations = useMemo<HubVacation[]>(() => (query.data ?? []).map((v) => ({ ...v, person: byAuthUid.get(v.uid) ?? null })), [query.data, byAuthUid]);
  return { vacations, loading: query.isLoading };
}

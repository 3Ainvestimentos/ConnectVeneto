"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { useTripsBirthdays, type LeaderTripType } from '@/contexts/TripsBirthdaysContext';
import { listenToCollectionWithQuery } from '@/lib/firestore-service';
import { normalizeEmail } from '@/lib/email-utils';
import { buildPeople, normalizeName, type HubPerson } from '@/lib/hub/people';
import { VACATION_REQUESTS_COLLECTION, type VacationRequest } from '@/types/vacation';

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

export interface HubVacation extends VacationRequest {
  person: HubPerson | null;
}

/**
 * Férias aprovadas de todo mundo (`vacation_requests` com status aprovado), para mostrar quem
 * está fora. As solicitações da própria pessoa continuam no contexto de férias.
 */
export function useApprovedVacations() {
  const { user } = useAuth();
  const { byAuthUid } = useHubPeople();
  const [raw, setRaw] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollectionWithQuery<VacationRequest>(
      VACATION_REQUESTS_COLLECTION,
      (data) => {
        setRaw(data as VacationRequest[]);
        setLoading(false);
      },
      () => setLoading(false),
      [{ field: 'status', operator: '==', value: 'approved' }],
    );
    return () => unsubscribe();
  }, [user]);

  const vacations = useMemo<HubVacation[]>(() => raw.map((v) => ({ ...v, person: byAuthUid.get(v.requesterUid) ?? null })), [raw, byAuthUid]);
  return { vacations, loading };
}

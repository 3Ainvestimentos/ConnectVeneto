"use client";

/**
 * Estado local do wireframe. Nada aqui grava no Firestore: tudo vive em memória e no localStorage
 * do navegador, para o time poder clicar à vontade. "Restaurar dados" volta ao mock original.
 *
 * Dados reais já integrados: Notícias publicadas pelo RH entram no feed via `syncExternalPosts`
 * (reações e comentários feitos nelas ficam só neste navegador, como o resto do mock).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CHANNELS, INITIAL_POSTS, INITIAL_TRIPS, INITIAL_VACATIONS, ME_ID, PEOPLE, SYSTEM_PEOPLE } from './data';
import type { Channel, Person, PersonalProfile, Post, Trip, Vacation, ViewerRole } from './types';

const STORAGE_KEY = 'hub-wireframe-v2';

interface PersistedState {
  posts: Post[];
  trips: Trip[];
  vacations: Vacation[];
  role: ViewerRole;
  following: string[];
  rsvp: Record<string, 'vou' | 'talvez' | 'nao'>;
  votes: Record<string, number>;
  myReactions: Record<string, string>;
  /** Dados pessoais que "você" editou no próprio perfil. */
  myProfile: PersonalProfile;
}

const initialState = (): PersistedState => ({
  posts: INITIAL_POSTS,
  trips: INITIAL_TRIPS,
  vacations: INITIAL_VACATIONS,
  role: 'publicador',
  following: CHANNELS.filter((c) => c.seeded).map((c) => c.id),
  rsvp: {},
  votes: {},
  myReactions: {},
  myProfile: {},
});

const uid = () => Math.random().toString(36).slice(2, 10);

const isBlob = (url?: string) => !!url?.startsWith('blob:');
function dropDeadBlobs(p: Post): Post {
  return {
    ...p,
    images: p.images?.filter((i) => !isBlob(i.url)),
    files: p.files?.filter((f) => !isBlob(f.url)),
    video: isBlob(p.video?.url) ? undefined : p.video,
  };
}

interface HubMockContextValue extends PersistedState {
  meId: string;
  me: Person;
  people: Person[];
  channels: Channel[];
  personById: (id: string) => Person;
  channelById: (id: string) => Channel;
  /** Canais em que o perfil simulado pode publicar. Vazio = não vê o botão "Nova publicação". */
  publishableChannels: Channel[];
  setRole: (role: ViewerRole) => void;
  toggleFollow: (channelId: string) => void;
  addPost: (input: Omit<Post, 'id' | 'authorId' | 'createdAt' | 'reactions' | 'comments'>) => void;
  /** Mescla publicações de outra fonte (Notícias) preservando reações/comentários já feitos. */
  syncExternalPosts: (external: Post[]) => void;
  react: (postId: string, emoji: string) => void;
  addComment: (postId: string, text: string) => void;
  toggleRelevant: (postId: string, commentId: string) => void;
  vote: (postId: string, optionIndex: number) => void;
  setRsvp: (postId: string, value: 'vou' | 'talvez' | 'nao') => void;
  saveTrip: (trip: Omit<Trip, 'id' | 'personId'> & { id?: string }) => void;
  deleteTrip: (tripId: string) => void;
  requestVacation: (start: string, end: string) => void;
  cancelVacation: (vacationId: string) => void;
  updateMyProfile: (profile: PersonalProfile) => void;
  reset: () => void;
}

const HubMockContext = createContext<HubMockContextValue | undefined>(undefined);

function mergeExternal(posts: Post[], external: Post[]): Post[] {
  const own = posts.filter((p) => !p.source);
  const previous = new Map(posts.filter((p) => p.source).map((p) => [p.id, p]));
  const merged = external.map((p) => {
    const prev = previous.get(p.id);
    return prev ? { ...p, reactions: prev.reactions, comments: prev.comments } : p;
  });
  return [...merged, ...own];
}

export function HubMockProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const externalRef = useRef<Post[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedState>;
        // Anexos de teste ficam em URLs `blob:` que morrem ao recarregar a página; descarta-os.
        const posts = saved.posts?.map(dropDeadBlobs);
        setState({ ...initialState(), ...saved, ...(posts ? { posts } : {}) });
      }
    } catch {
      /* sem storage: segue com o mock original */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state, hydrated]);

  const personById = useCallback(
    (id: string) => {
      const base = PEOPLE.find((p) => p.id === id) ?? SYSTEM_PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];
      return id === ME_ID ? { ...base, ...state.myProfile } : base;
    },
    [state.myProfile],
  );
  const channelById = useCallback((id: string) => CHANNELS.find((c) => c.id === id) ?? CHANNELS[0], []);
  const me = personById(ME_ID);
  const people = useMemo(() => PEOPLE.map((p) => (p.id === ME_ID ? { ...p, ...state.myProfile } : p)), [state.myProfile]);

  // No modo "publicador" o wireframe simula alguém da Comunicação, que publica em qualquer canal.
  // Na implementação real: Comunicação vê todos; os demais, só os canais em que estão em `publisherIds`.
  const publishableChannels = useMemo(() => (state.role === 'publicador' ? CHANNELS : []), [state.role]);

  const updatePost = (postId: string, fn: (p: Post) => Post) =>
    setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? fn(p) : p)) }));

  const value: HubMockContextValue = {
    ...state,
    meId: ME_ID,
    me,
    people,
    channels: CHANNELS,
    personById,
    channelById,
    publishableChannels,
    setRole: (role) => setState((s) => ({ ...s, role })),
    toggleFollow: (channelId) =>
      setState((s) => ({
        ...s,
        following: s.following.includes(channelId)
          ? s.following.filter((c) => c !== channelId)
          : [...s.following, channelId],
      })),
    addPost: (input) =>
      setState((s) => ({
        ...s,
        posts: [
          { ...input, id: uid(), authorId: ME_ID, createdAt: new Date().toISOString(), reactions: {}, comments: [] },
          ...s.posts,
        ],
      })),
    syncExternalPosts: (external) => {
      externalRef.current = external;
      setState((s) => ({ ...s, posts: mergeExternal(s.posts, external) }));
    },
    react: (postId, emoji) =>
      setState((s) => {
        const previous = s.myReactions[postId];
        const posts = s.posts.map((p) => {
          if (p.id !== postId) return p;
          const reactions = { ...p.reactions };
          if (previous) reactions[previous] = Math.max(0, (reactions[previous] ?? 1) - 1);
          if (previous !== emoji) reactions[emoji] = (reactions[emoji] ?? 0) + 1;
          return { ...p, reactions };
        });
        const myReactions = { ...s.myReactions };
        if (previous === emoji) delete myReactions[postId];
        else myReactions[postId] = emoji;
        return { ...s, posts, myReactions };
      }),
    addComment: (postId, text) =>
      updatePost(postId, (p) => ({
        ...p,
        comments: [
          ...p.comments,
          { id: uid(), authorId: ME_ID, text, createdAt: new Date().toISOString(), relevant: false },
        ],
      })),
    toggleRelevant: (postId, commentId) =>
      updatePost(postId, (p) => ({
        ...p,
        comments: p.comments.map((c) => (c.id === commentId ? { ...c, relevant: !c.relevant } : c)),
      })),
    vote: (postId, optionIndex) =>
      setState((s) => {
        if (s.votes[postId] !== undefined) return s;
        return {
          ...s,
          votes: { ...s.votes, [postId]: optionIndex },
          posts: s.posts.map((p) =>
            p.id === postId && p.poll
              ? {
                  ...p,
                  poll: {
                    ...p.poll,
                    options: p.poll.options.map((o, i) => (i === optionIndex ? { ...o, votes: o.votes + 1 } : o)),
                  },
                }
              : p,
          ),
        };
      }),
    setRsvp: (postId, v) =>
      setState((s) => {
        const rsvp = { ...s.rsvp };
        if (rsvp[postId] === v) delete rsvp[postId];
        else rsvp[postId] = v;
        return { ...s, rsvp };
      }),
    saveTrip: ({ id, ...trip }) =>
      setState((s) => ({
        ...s,
        trips: id
          ? s.trips.map((t) => (t.id === id ? { ...t, ...trip } : t))
          : [...s.trips, { ...trip, id: uid(), personId: ME_ID }],
      })),
    deleteTrip: (tripId) => setState((s) => ({ ...s, trips: s.trips.filter((t) => t.id !== tripId) })),
    requestVacation: (start, end) =>
      setState((s) => ({
        ...s,
        vacations: [
          ...s.vacations,
          { id: uid(), personId: ME_ID, start, end, status: 'pending', approverId: me.managerId ?? 'ana' },
        ],
      })),
    cancelVacation: (vacationId) =>
      setState((s) => ({ ...s, vacations: s.vacations.filter((v) => v.id !== vacationId) })),
    updateMyProfile: (profile) => setState((s) => ({ ...s, myProfile: { ...s.myProfile, ...profile } })),
    reset: () => setState({ ...initialState(), posts: mergeExternal(INITIAL_POSTS, externalRef.current) }),
  };

  return <HubMockContext.Provider value={value}>{children}</HubMockContext.Provider>;
}

export function useHubMock(): HubMockContextValue {
  const ctx = useContext(HubMockContext);
  if (!ctx) throw new Error('useHubMock must be used within HubMockProvider');
  return ctx;
}

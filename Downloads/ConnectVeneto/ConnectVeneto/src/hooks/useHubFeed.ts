"use client";

/**
 * Cliente do Hub de Comunicação: leitura e ações do feed via /api/feed (Admin SDK no servidor).
 * Ações atualizam o cache de forma otimista e reconciliam com o servidor ao terminar.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { CreatePostInput, DigestResponse, FeedChannel, FeedComment, FeedPost, RsvpAnswer } from '@/lib/hub/model';

export const FEED_QUERY_KEY = ['hub-feed'] as const;
const commentsKey = (postId: string) => ['hub-feed', 'comments', postId] as const;

export interface FeedResponse {
  posts: FeedPost[];
  channels: FeedChannel[];
  /** Último Resumo diário visto (null = nunca). */
  digestSeenAt: string | null;
  viewer: { email: string; name: string; isContentManager: boolean };
}

export class HubApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function useApi() {
  const { user } = useAuth();
  return useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/feed${path}`, {
        method: init?.method ?? 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new HubApiError(typeof payload?.error === 'string' ? payload.error : 'Falha na comunicação.', res.status);
      return payload as T;
    },
    [user],
  );
}

export function useHubFeed() {
  const api = useApi();
  const { user } = useAuth();
  return useQuery({
    queryKey: FEED_QUERY_KEY,
    queryFn: () => api<FeedResponse>(''),
    enabled: !!user,
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof HubApiError && error.status === 403) && count < 2,
  });
}

/** Busca o Resumo diário. `since` força a janela (Resumo aberto sob demanda). */
export function useHubDigestApi() {
  const api = useApi();
  const qc = useQueryClient();
  return {
    fetchDigest: (since?: string) => api<DigestResponse>(`/digest${since ? `?since=${encodeURIComponent(since)}` : ''}`),
    markSeen: async () => {
      await api<{ lastSeenAt: string }>('/digest/seen', { method: 'POST' });
      qc.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
  };
}

export function useHubComments(postId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: commentsKey(postId),
    queryFn: () => api<{ comments: FeedComment[] }>(`/posts/${postId}/comments`).then((r) => r.comments),
    enabled,
  });
}

/** Ações do feed. Cada uma devolve uma Promise para a tela poder mostrar erro. */
export function useHubFeedActions() {
  const api = useApi();
  const qc = useQueryClient();

  const patchPost = (postId: string, fn: (p: FeedPost) => FeedPost) =>
    qc.setQueryData<FeedResponse>(FEED_QUERY_KEY, (old) => (old ? { ...old, posts: old.posts.map((p) => (p.id === postId ? fn(p) : p)) } : old));
  const refresh = () => qc.invalidateQueries({ queryKey: FEED_QUERY_KEY });

  const createPost = useMutation({
    mutationFn: (input: CreatePostInput) => api<{ post: FeedPost }>('/posts', { method: 'POST', body: input }),
    onSuccess: refresh,
  });

  const react = useMutation({
    mutationFn: ({ postId, emoji }: { postId: string; emoji: string | null }) => api(`/posts/${postId}/reaction`, { method: 'PUT', body: { emoji } }),
    onMutate: ({ postId, emoji }) =>
      patchPost(postId, (p) => {
        const counts = { ...p.reactionCounts };
        if (p.myReaction) counts[p.myReaction] = Math.max(0, (counts[p.myReaction] ?? 1) - 1);
        if (emoji) counts[emoji] = (counts[emoji] ?? 0) + 1;
        return { ...p, reactionCounts: counts, myReaction: emoji };
      }),
    onSettled: refresh,
  });

  const rsvp = useMutation({
    mutationFn: ({ postId, answer }: { postId: string; answer: RsvpAnswer | null }) => api(`/posts/${postId}/rsvp`, { method: 'PUT', body: { answer } }),
    onMutate: ({ postId, answer }) =>
      patchPost(postId, (p) => {
        const counts = { ...p.rsvpCounts };
        if (p.myRsvp) counts[p.myRsvp] = Math.max(0, counts[p.myRsvp] - 1);
        if (answer) counts[answer] += 1;
        return { ...p, rsvpCounts: counts, myRsvp: answer };
      }),
    onSettled: refresh,
  });

  const vote = useMutation({
    mutationFn: ({ postId, optionIndex }: { postId: string; optionIndex: number }) => api(`/posts/${postId}/vote`, { method: 'POST', body: { optionIndex } }),
    onMutate: ({ postId, optionIndex }) =>
      patchPost(postId, (p) =>
        p.myVote !== null ? p : { ...p, myVote: optionIndex, pollCounts: p.pollCounts.map((n, i) => (i === optionIndex ? n + 1 : n)) },
      ),
    onSettled: refresh,
  });

  const follow = useMutation({
    mutationFn: ({ channelId, following }: { channelId: string; following: boolean }) =>
      api(`/channels/${channelId}/follow`, { method: 'PUT', body: { following } }),
    onMutate: ({ channelId, following }) =>
      qc.setQueryData<FeedResponse>(FEED_QUERY_KEY, (old) =>
        old ? { ...old, channels: old.channels.map((c) => (c.id === channelId ? { ...c, following } : c)) } : old,
      ),
    onSettled: refresh,
  });

  const addComment = useMutation({
    mutationFn: ({ postId, text }: { postId: string; text: string }) => api<{ comment: FeedComment }>(`/posts/${postId}/comments`, { method: 'POST', body: { text } }),
    onSuccess: (_r, { postId }) => {
      qc.invalidateQueries({ queryKey: commentsKey(postId) });
      refresh();
    },
  });

  const setRelevant = useMutation({
    mutationFn: ({ postId, commentId, relevant }: { postId: string; commentId: string; relevant: boolean }) =>
      api(`/posts/${postId}/comments/${commentId}`, { method: 'PATCH', body: { relevant } }),
    onMutate: ({ postId, commentId, relevant }) =>
      qc.setQueryData<FeedComment[]>(commentsKey(postId), (old) => old?.map((c) => (c.id === commentId ? { ...c, relevant } : c))),
    onSettled: (_r, _e, { postId }) => {
      qc.invalidateQueries({ queryKey: commentsKey(postId) });
      refresh();
    },
  });

  const updatePost = useMutation({
    mutationFn: ({ postId, patch }: { postId: string; patch: Record<string, unknown> }) => api(`/posts/${postId}`, { method: 'PATCH', body: patch }),
    onSuccess: refresh,
  });

  return { createPost, react, rsvp, vote, follow, addComment, setRelevant, updatePost };
}

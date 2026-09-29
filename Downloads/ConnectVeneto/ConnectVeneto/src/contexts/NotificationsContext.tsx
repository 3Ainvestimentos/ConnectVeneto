"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { getClientFirestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeEmail } from '@/lib/email-utils';
import { NOTIFICATIONS_COLLECTION, type HubNotification } from '@/lib/notifications/types';

const MAX_ITEMS = 50;
const SOUND_URL = '/sounds/notification.wav';
const SOUND_CLAIM_KEY = 'cv-notifications:last-sound';
const TITLE_PREFIX = /^\(\d+\+?\)\s+/;

type NotificationsContextValue = {
  notifications: HubNotification[];
  unreadCount: number;
  loading: boolean;
  /** Marca como lidas as notificações 'on_open' não lidas (ao abrir o sino). */
  markOpenedAsRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

function toMillis(value: unknown): number | null {
  const ts = value as Timestamp | null | undefined;
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null;
}

/**
 * Evita que várias abas toquem o som para a mesma notificação: a primeira aba
 * que "reivindica" o id no localStorage toca. Abas ocultas esperam um pouco
 * para dar preferência à aba visível.
 */
function claimSound(id: string): boolean {
  try {
    const raw = localStorage.getItem(SOUND_CLAIM_KEY);
    const last = raw ? (JSON.parse(raw) as { id: string; at: number }) : null;
    if (last && last.id === id && Date.now() - last.at < 10_000) return false;
    localStorage.setItem(SOUND_CLAIM_KEY, JSON.stringify({ id, at: Date.now() }));
    return true;
  } catch {
    return true;
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const email = normalizeEmail(user?.email);
  const [notifications, setNotifications] = useState<HubNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const seenIdsRef = useRef<Set<string> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback((id: string) => {
    const play = () => {
      if (!claimSound(id)) return;
      try {
        audioRef.current ??= new Audio(SOUND_URL);
        audioRef.current.currentTime = 0;
        // Navegadores bloqueiam áudio antes da primeira interação com a página.
        void audioRef.current.play().catch(() => {});
      } catch {
        /* sem áudio disponível */
      }
    };
    if (document.visibilityState === 'visible') play();
    else setTimeout(play, 400);
  }, []);

  useEffect(() => {
    if (!email) {
      setNotifications([]);
      setLoading(false);
      seenIdsRef.current = null;
      return;
    }
    setLoading(true);
    seenIdsRef.current = null;

    // Só igualdade: usa o índice de campo único automático do Firestore. Um
    // orderBy/limit exigiria índice composto, e a service account do app não tem
    // permissão para criá-lo. A ordenação é feita aqui, e o volume por pessoa é pequeno.
    const q = query(
      collection(getClientFirestore(), NOTIFICATIONS_COLLECTION),
      where('recipientEmail', '==', email),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const all: HubNotification[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            recipientEmail: data.recipientEmail,
            source: data.source,
            title: data.title,
            body: data.body ?? null,
            link: data.link ?? null,
            externalRef: data.externalRef ?? null,
            readPolicy: data.readPolicy === 'on_resolve' ? 'on_resolve' : 'on_open',
            read: data.read === true,
            createdAt: toMillis(data.createdAt) ?? Date.now(),
            readAt: toMillis(data.readAt),
            resolvedAt: toMillis(data.resolvedAt),
          };
        });

        all.sort((a, b) => b.createdAt - a.createdAt);
        // Lista mostra as mais recentes + todas as não lidas (o contador nunca "esconde" pendência).
        const items = all.filter((n, i) => i < MAX_ITEMS || !n.read);

        // Som: só para notificações não lidas que surgiram (ou reabriram) depois
        // do primeiro snapshot — o carregamento inicial nunca toca.
        const seen = seenIdsRef.current;
        const unreadIds = all.filter((n) => !n.read).map((n) => n.id);
        if (seen) {
          const fresh = unreadIds.find((id) => !seen.has(id));
          if (fresh) playSound(fresh);
        }
        seenIdsRef.current = new Set(unreadIds);

        setNotifications(items);
        setLoading(false);
      },
      (error) => {
        console.error('[notifications] falha no listener:', error);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [email, playSound]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Contador no título da aba, como no WhatsApp: "(3) Vêneto Connect".
  // O MutationObserver reaplica o prefixo quando o Next troca o <title> na navegação.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_PREFIX, '');
      const next = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(TITLE_PREFIX, '');
    };
  }, [unreadCount]);

  const markOpenedAsRead = useCallback(async () => {
    const targets = notifications.filter((n) => !n.read && n.readPolicy === 'on_open');
    if (targets.length === 0) return;
    const db = getClientFirestore();
    const batch = writeBatch(db);
    for (const n of targets) {
      batch.update(doc(db, NOTIFICATIONS_COLLECTION, n.id), { read: true, readAt: serverTimestamp() });
    }
    try {
      await batch.commit();
    } catch (error) {
      console.error('[notifications] falha ao marcar como lidas:', error);
    }
  }, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, markOpenedAsRead }),
    [notifications, unreadCount, loading, markOpenedAsRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications deve ser usado dentro de NotificationsProvider');
  return ctx;
}

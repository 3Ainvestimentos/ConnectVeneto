"use client";

import { useEffect, useRef } from 'react';
import { doc, increment, setDoc } from 'firebase/firestore';
import { getClientFirestore } from '@/lib/firebase';
import type { HubModule } from '@/config/modules';
import {
  MODULE_USAGE_COLLECTION,
  resolveModuleForPath,
  usageDateKey,
  type ResolvedModule,
} from '@/lib/module-usage';

/** De quanto em quanto tempo o relógio confere se a pessoa está ativa. */
const TICK_MS = 15_000;
/** Sem mouse/teclado/scroll por esse tempo, o tempo para de contar. */
const IDLE_MS = 5 * 60_000;
/**
 * Com o foco dentro de um módulo embarcado (iframe), os eventos de mouse e teclado
 * ficam no iframe e não chegam aqui. Nesse caso o foco no iframe conta como
 * atividade, com um teto maior para não contar a tela esquecida aberta.
 */
const IFRAME_IDLE_MS = 30 * 60_000;
/** Grava o acumulado periodicamente, para uma aba que trava não perder a sessão inteira. */
const FLUSH_EVERY_MS = 10 * 60_000;
/** Passagens rápidas pela rota (redirect, clique errado) não entram no relatório. */
const MIN_FLUSH_SECONDS = 3;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

type TrackedUser = { uid: string; userId: string; userName: string; email: string };

type Segment = ResolvedModule & {
  activeMs: number;
  lastFlushAt: number;
  /** A visita ao módulo é contada uma vez, na primeira gravação do trecho. */
  visitCounted: boolean;
};

/**
 * Mede o tempo ativo de cada pessoa em cada módulo do menu e soma no doc do dia em
 * `moduleUsage` (veja lib/module-usage.ts).
 *
 * "Ativo" é aba visível e alguma interação nos últimos 5 minutos. O acumulado é
 * gravado ao trocar de módulo, ao esconder a aba (inclui fechar) e a cada 10 min.
 */
export function useModuleTimeTracking(
  pathname: string | null,
  modules: HubModule[],
  user: TrackedUser | null
): void {
  const segmentRef = useRef<Segment | null>(null);
  const userRef = useRef<TrackedUser | null>(user);
  const lastTickRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  /** Estado do intervalo que começou no último tick: credita o intervalo inteiro ou nada. */
  const countingRef = useRef(false);

  userRef.current = user;

  const isActiveNow = (now: number): boolean => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
    const idleFor = now - lastActivityRef.current;
    if (idleFor < IDLE_MS) return true;
    return document.activeElement?.tagName === 'IFRAME' && idleFor < IFRAME_IDLE_MS;
  };

  const tick = () => {
    const now = Date.now();
    const segment = segmentRef.current;
    if (segment && countingRef.current) {
      // Teto: um timer atrasado (máquina suspensa) não vira horas de uso.
      segment.activeMs += Math.min(now - lastTickRef.current, TICK_MS * 2);
    }
    lastTickRef.current = now;
    countingRef.current = isActiveNow(now);
  };

  const flush = () => {
    tick();
    const segment = segmentRef.current;
    const trackedUser = userRef.current;
    if (!segment || !trackedUser) return;

    const seconds = Math.round(segment.activeMs / 1000);
    segment.lastFlushAt = Date.now();
    if (seconds < MIN_FLUSH_SECONDS) return;

    const visits = segment.visitCounted ? 0 : 1;
    segment.activeMs = 0;
    segment.visitCounted = true;

    const date = usageDateKey();
    setDoc(
      doc(getClientFirestore(), MODULE_USAGE_COLLECTION, `${date}_${trackedUser.uid}`),
      {
        uid: trackedUser.uid,
        userId: trackedUser.userId,
        userName: trackedUser.userName,
        email: trackedUser.email,
        date,
        modules: {
          [segment.id]: {
            label: segment.label,
            seconds: increment(seconds),
            visits: increment(visits),
          },
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch((error) => console.error('[moduleUsage] falha ao gravar tempo de uso:', error));
  };

  // Troca de rota: se mudou o módulo, fecha o trecho anterior e abre outro.
  const resolved = pathname ? resolveModuleForPath(pathname, modules) : null;
  const resolvedId = resolved?.id ?? null;
  const resolvedLabel = resolved?.label ?? null;
  const userUid = user?.uid ?? null;

  useEffect(() => {
    if (!resolvedId || !resolvedLabel || !userUid) return;
    if (segmentRef.current?.id === resolvedId) return;

    flush();
    segmentRef.current = {
      id: resolvedId,
      label: resolvedLabel,
      activeMs: 0,
      lastFlushAt: Date.now(),
      visitCounted: false,
    };
    lastActivityRef.current = Date.now();
    lastTickRef.current = Date.now();
    countingRef.current = isActiveNow(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush/isActiveNow só leem refs.
  }, [resolvedId, resolvedLabel, userUid]);

  useEffect(() => {
    if (!userUid) return;

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      // Voltou de inatividade: o tempo recomeça agora, não no próximo tick.
      if (!countingRef.current) tick();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
      else onActivity();
    };

    const interval = window.setInterval(() => {
      tick();
      const segment = segmentRef.current;
      if (segment && Date.now() - segment.lastFlushAt >= FLUSH_EVERY_MS) flush();
    }, TICK_MS);

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
      // Troca de usuário ou logout: encerra o trecho (no logout já não há sessão para gravar).
      flush();
      segmentRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- os handlers só leem refs.
  }, [userUid]);
}

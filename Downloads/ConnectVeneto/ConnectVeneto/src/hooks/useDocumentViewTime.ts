"use client";

import { useEffect, useRef } from "react";
import { addDocumentToCollection } from "@/lib/firestore-service";

/** Evento em `audit_logs` com o tempo que um documento ficou aberto no visualizador. */
export const DOCUMENT_VIEW_TIME_EVENT = "document_view_time";

/** De quanto em quanto tempo o relógio confere se o documento está sendo visto. */
const TICK_MS = 5_000;
/**
 * Ler um PDF ou mexer num simulador pode passar muito tempo sem mouse/teclado na
 * janela (os eventos de dentro do iframe não chegam aqui). Por isso o teto de
 * inatividade é largo: só corta a tela esquecida aberta.
 */
const IDLE_MS = 30 * 60_000;
/** Abrir e fechar na hora não vira registro. */
const MIN_SECONDS = 1;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;

export type DocumentView = {
  /** Mesmo id gravado em `details.viewId` no evento de abertura (document_download). */
  viewId: string;
  documentId: string;
  documentName: string;
  contentType: string;
  source: string;
  segment?: string;
  userId: string | null;
  userName: string;
};

/** Id que liga a abertura do documento aos registros de tempo dela. */
export const newDocumentViewId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Mede quanto tempo o documento ficou aberto no visualizador, com a aba visível, e
 * grava em `audit_logs` ao fechar.
 *
 * Se a pessoa troca de aba ou fecha o navegador com o documento aberto, o trecho
 * até ali é gravado na hora (a gravação no fechamento é melhor esforço); voltando,
 * a contagem continua num novo registro com o mesmo `viewId`. O tempo de uma
 * abertura é a soma de `durationSeconds` dos registros com o mesmo `viewId`.
 */
export function useDocumentViewTime(view: DocumentView | null): void {
  const viewRef = useRef<DocumentView | null>(null);
  const activeMsRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const lastTickRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const countingRef = useRef(false);

  const isActiveNow = (now: number): boolean =>
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    now - lastActivityRef.current < IDLE_MS;

  const tick = () => {
    const now = Date.now();
    if (viewRef.current && countingRef.current) {
      // Teto: um timer atrasado (máquina suspensa) não vira horas de leitura.
      activeMsRef.current += Math.min(now - lastTickRef.current, TICK_MS * 2);
    }
    lastTickRef.current = now;
    countingRef.current = isActiveNow(now);
  };

  const flush = (reason: "closed" | "hidden") => {
    tick();
    const current = viewRef.current;
    const seconds = Math.round(activeMsRef.current / 1000);
    const startedAt = startedAtRef.current;
    activeMsRef.current = 0;
    startedAtRef.current = null;
    if (!current || seconds < MIN_SECONDS) return;

    void addDocumentToCollection("audit_logs", {
      eventType: DOCUMENT_VIEW_TIME_EVENT,
      userId: current.userId,
      userName: current.userName,
      timestamp: new Date().toISOString(),
      details: {
        viewId: current.viewId,
        documentId: current.documentId,
        documentName: current.documentName,
        contentId: current.documentId,
        contentTitle: current.documentName,
        contentType: current.contentType,
        source: current.source,
        segment: current.segment,
        durationSeconds: seconds,
        startedAt,
        endReason: reason,
      },
    }).catch((error) => console.error("[documentViewTime] falha ao gravar tempo:", error));
  };

  const startSegment = () => {
    const now = Date.now();
    startedAtRef.current = new Date(now).toISOString();
    activeMsRef.current = 0;
    lastTickRef.current = now;
    lastActivityRef.current = now;
    countingRef.current = isActiveNow(now);
  };

  const viewId = view?.viewId ?? null;

  // Abriu, trocou ou fechou o documento.
  useEffect(() => {
    if (!view) return;
    viewRef.current = view;
    startSegment();
    return () => {
      flush("closed");
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a abertura é identificada pelo viewId.
  }, [viewId]);

  useEffect(() => {
    if (!viewId) return;

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (!countingRef.current) tick();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush("hidden");
      } else if (viewRef.current) {
        startSegment();
      }
    };

    const onPageHide = () => flush("hidden");

    const interval = window.setInterval(tick, TICK_MS);
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- os handlers só leem refs.
  }, [viewId]);
}

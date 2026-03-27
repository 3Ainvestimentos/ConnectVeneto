"use client";

import { FEATURE_FLAGS } from "@/config/features";

declare global {
  interface Window {
    __cvBootstrapStartMs?: number;
    __cvBootstrapTrace?: Array<{
      stage: string;
      elapsedMs: number;
      atIso: string;
      data?: Record<string, unknown>;
    }>;
  }
}

const isTraceEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!FEATURE_FLAGS.debugBootstrap;
};

export const bootstrapTrace = (
  stage: string,
  data?: Record<string, unknown>
): void => {
  if (!isTraceEnabled()) return;

  const now = Date.now();
  if (!window.__cvBootstrapStartMs) {
    window.__cvBootstrapStartMs = now;
  }

  const elapsedMs = now - window.__cvBootstrapStartMs;
  const event = {
    stage,
    elapsedMs,
    atIso: new Date(now).toISOString(),
    data,
  };

  window.__cvBootstrapTrace = window.__cvBootstrapTrace || [];
  window.__cvBootstrapTrace.push(event);

  console.info("[CV bootstrap]", event);
};

export const resetBootstrapTrace = (): void => {
  if (!isTraceEnabled() || typeof window === "undefined") return;
  window.__cvBootstrapStartMs = Date.now();
  window.__cvBootstrapTrace = [];
  bootstrapTrace("trace_reset");
};


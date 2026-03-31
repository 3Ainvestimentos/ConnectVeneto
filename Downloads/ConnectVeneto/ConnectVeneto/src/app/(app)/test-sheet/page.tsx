"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";

const EDIT_URL =
  "https://docs.google.com/spreadsheets/d/11uVLUqkJALLCVNZQJJBrEZ-ciQL40G21s7MCdVehlnw/edit?gid=0#gid=0";
const PREVIEW_URL =
  "https://docs.google.com/spreadsheets/d/11uVLUqkJALLCVNZQJJBrEZ-ciQL40G21s7MCdVehlnw/preview";

export default function TestSheetPage() {
  const [src, setSrc] = React.useState(EDIT_URL);
  const [loaded, setLoaded] = React.useState(false);
  const [usedFallback, setUsedFallback] = React.useState(false);

  React.useEffect(() => {
    if (src !== EDIT_URL || loaded) return;

    const timer = window.setTimeout(() => {
      if (!loaded) {
        setUsedFallback(true);
        setSrc(PREVIEW_URL);
      }
    }, 7000);

    return () => window.clearTimeout(timer);
  }, [src, loaded]);

  return (
    <div className="flex h-full w-full flex-col p-6 md:p-8 gap-4">
      <PageHeader
        title="Planilha Teste"
        description="Teste de exibição de Google Planilhas em iframe."
      />

      {usedFallback && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          O link em modo <strong>/edit</strong> aparentou bloqueio de exibição em iframe.
          Consequencia: a planilha pode nao abrir embutida por politica de seguranca do Google.
          Ajuste automatico aplicado para o modo <strong>/preview</strong>.
        </div>
      )}

      <div className="relative h-[calc(100vh-240px)] min-h-[520px] w-full overflow-hidden rounded-md border">
        <iframe
          title="Planilha Teste Veneto"
          width="100%"
          height="100%"
          src={src}
          frameBorder="0"
          allowFullScreen={true}
          className="absolute inset-0 h-full w-full border-0"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}

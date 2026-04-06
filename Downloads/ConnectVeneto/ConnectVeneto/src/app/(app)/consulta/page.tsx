"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

type ConsultaTab = 'mesa' | 'cliente' | 'cx';

const TAB_LABELS: Record<ConsultaTab, string> = {
  mesa: 'MESA',
  cliente: 'CLIENTE',
  cx: 'CX',
};

function toPreviewUrl(url: string): string {
  if (url.includes('docs.google.com/spreadsheets') && url.includes('/edit')) {
    return url.replace(/\/edit.*$/, '/preview');
  }
  return url;
}

function IframePanel({ url, label }: { url: string; label: string }) {
  const [loaded, setLoaded] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [src, setSrc] = useState(url);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoaded(false);
    setUsedFallback(false);
    setSrc(url);
  }, [url]);

  useEffect(() => {
    if (loaded) return;

    timerRef.current = setTimeout(() => {
      if (!loaded) {
        const fallback = toPreviewUrl(src);
        if (fallback !== src) {
          setUsedFallback(true);
          setSrc(fallback);
        }
      }
    }, 7000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [src, loaded]);

  return (
    <div className="flex flex-col w-full h-full">
      {usedFallback && (
        <div className="mx-4 mt-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Ajuste automático aplicado: exibindo no modo <strong>/preview</strong> por restrição do Google Sheets.
        </div>
      )}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <iframe
          key={src}
          aria-label={`Planilha de consulta: ${label}`}
          width="100%"
          height="100%"
          src={src}
          frameBorder="0"
          allowFullScreen
          allow="fullscreen; clipboard-read; clipboard-write; autoplay"
          className="absolute inset-0 h-full w-full border-0"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}

export default function ConsultaPage() {
  const { user, loading: userLoading } = useAuth();
  const { collaborators, loading: collabLoading } = useCollaborators();

  const consultaLinks = useMemo(() => {
    if (userLoading || collabLoading || !user) return null;
    const currentUser = findCollaboratorByEmail(collaborators, user.email);
    return currentUser?.consultaLinks ?? null;
  }, [user, collaborators, userLoading, collabLoading]);

  const availableTabs = useMemo<ConsultaTab[]>(() => {
    if (!consultaLinks) return [];
    return (['mesa', 'cliente', 'cx'] as ConsultaTab[]).filter(
      (tab) => !!consultaLinks[tab]
    );
  }, [consultaLinks]);

  const [activeTab, setActiveTab] = useState<ConsultaTab | null>(null);

  useEffect(() => {
    if (availableTabs.length > 0 && !activeTab) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  if (userLoading || collabLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (availableTabs.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background p-4 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-10 w-10" />
          <h2 className="text-xl font-semibold text-foreground">Consulta não configurada</h2>
          <p>Nenhum link de Consulta Pessoal foi configurado para o seu usuário.</p>
        </div>
      </div>
    );
  }

  const activeUrl = activeTab ? consultaLinks![activeTab] : '';

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Consulta Pessoal</h1>
          <p className="text-sm text-muted-foreground">Acesse suas planilhas de consulta.</p>
        </div>
        {availableTabs.length > 1 && (
          <div
            role="tablist"
            aria-label="Tipo de consulta"
            className="inline-flex h-9 shrink-0 items-center rounded-md bg-muted p-1 text-muted-foreground"
          >
            {availableTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab && activeUrl && (
          <IframePanel key={activeTab} url={activeUrl} label={TAB_LABELS[activeTab]} />
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getEmbeddedModule } from '@/config/modules';

// Se o módulo não emitir CV_MODULE_READY (versões antigas do protocolo),
// revela o iframe mesmo assim em vez de deixar o skeleton eterno.
const READY_FALLBACK_MS = 8000;

type ModuleEmbedProps = {
  /** Id do módulo em EMBEDDED_MODULES (config/modules.ts). */
  moduleId: string;
  /** Título de acessibilidade do iframe. */
  title: string;
  /** Corpo extra enviado ao token route a cada emissão (ex: { simulateAs }). */
  tokenBody?: Record<string, unknown>;
  /** Mudar este valor recarrega o iframe e re-arma o skeleton. */
  reloadKey?: string | number;
  /** Skeleton customizado exibido até CV_MODULE_READY (ou fallback de 8s). */
  skeleton?: React.ReactNode;
  /** Classes do container externo — define as dimensões do embed. */
  className?: string;
  /** Classes extras do iframe (ex: rounded-lg). */
  iframeClassName?: string;
};

/**
 * Embed genérico de módulo via iframe + hub-auth (CONNECTVENETO_MODULE_PROTOCOL.md v1.2).
 *
 * Responsabilidades:
 * - só monta o iframe após o Firebase Auth restaurar a sessão (guard `user`);
 * - responde CV_REQUEST_AUTH / CV_TOKEN_EXPIRED emitindo o Module Token;
 * - envia o token proativamente no onLoad do iframe (push, tolerado pelo módulo);
 * - mostra skeleton até CV_MODULE_READY, com fallback de 8s.
 */
export default function ModuleEmbed({
  moduleId,
  title,
  tokenBody,
  reloadKey,
  skeleton,
  className,
  iframeClassName,
}: ModuleEmbedProps) {
  const config = getEmbeddedModule(moduleId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const { user } = useAuth();

  // Ref para o corpo do token: callbacks leem sempre o valor atual sem
  // reinstalar o listener de message a cada render.
  const tokenBodyRef = useRef(tokenBody);
  tokenBodyRef.current = tokenBody;

  const moduleUrl = config?.url ?? '';
  const embedSrc = config ? `${config.url}${config.embedPath}` : '';

  const issueToken = useCallback(async (): Promise<string | null> => {
    const auth = getAuth(getFirebaseApp());
    // Aguarda o Firebase restaurar a sessão — currentUser é null durante o bootstrap.
    await auth.authStateReady();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      console.warn(`[ModuleEmbed:${moduleId}] usuário não autenticado; token não emitido`);
      return null;
    }

    const body = tokenBodyRef.current;
    const res = await fetch(`/api/modules/${moduleId}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      console.warn(`[ModuleEmbed:${moduleId}] falha ao emitir token`, res.status);
      return null;
    }
    const { token } = await res.json();
    return token as string;
  }, [moduleId]);

  const sendToken = useCallback(async () => {
    const token = await issueToken();
    if (!token) return;
    if (!iframeRef.current?.contentWindow) {
      console.warn(`[ModuleEmbed:${moduleId}] iframe indisponível para envio do token`);
      return;
    }
    iframeRef.current.contentWindow.postMessage({ type: 'CV_AUTH_TOKEN', token }, moduleUrl);
  }, [issueToken, moduleId, moduleUrl]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== moduleUrl) return;
      const type = event.data?.type;
      if (type === 'CV_REQUEST_AUTH' || type === 'CV_TOKEN_EXPIRED') sendToken();
      if (type === 'CV_MODULE_READY') setIsReady(true);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToken, moduleUrl]);

  // Re-arma o skeleton quando o consumidor pede recarga do iframe.
  useEffect(() => {
    setIsReady(false);
  }, [reloadKey]);

  // Fallback do skeleton eterno.
  useEffect(() => {
    if (isReady) return;
    const t = setTimeout(() => setIsReady(true), READY_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [isReady]);

  if (!config) {
    console.warn(`[ModuleEmbed] módulo não registrado em EMBEDDED_MODULES: ${moduleId}`);
    return null;
  }

  return (
    <div className={className ?? 'relative w-full h-full'}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: isReady ? 0 : 1, transition: 'opacity 0.4s ease' }}
        aria-hidden="true"
      >
        {skeleton ?? <DefaultSkeleton />}
      </div>

      {/* Iframe — só renderiza após Firebase Auth restaurar a sessão.
          Se renderizar antes, auth.currentUser é null e o token nunca é emitido. */}
      {user && (
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={embedSrc}
          onLoad={() => sendToken()}
          className={`absolute inset-0 w-full h-full border-0 ${iframeClassName ?? ''}`}
          style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.4s ease' }}
          title={title}
        />
      )}
    </div>
  );
}

function DefaultSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-8 w-full h-full rounded-lg" style={{ background: '#f8fafc' }}>
      <div className="h-6 w-56 rounded animate-pulse" style={{ background: '#e2e8f0' }} />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }} />
        ))}
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}>
        {[100, 88, 94, 80].map((w, i) => (
          <div key={i} className="flex items-center px-4" style={{ height: 48, borderBottom: '1px solid #f1f5f9' }}>
            <div className="h-3 rounded animate-pulse flex-1" style={{ background: '#e2e8f0', maxWidth: `${w}%`, animationDelay: `${i * 80}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

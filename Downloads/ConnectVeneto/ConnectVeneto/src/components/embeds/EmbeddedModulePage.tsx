'use client';

import ModuleEmbed from '@/components/embeds/ModuleEmbed';
import { PageHeader } from '@/components/layout/PageHeader';
import type { EmbeddedHubModule } from '@/config/modules';

/**
 * Página de um módulo embarcado, montada a partir do registro `hubModules`.
 * - layout 'framed': cabeçalho + cartão com borda (como o TrackFlow);
 * - layout 'fullscreen': ocupa toda a área abaixo do header (como o Dados Estratégicos).
 */
export default function EmbeddedModulePage({ module: mod }: { module: EmbeddedHubModule }) {
  const skeleton = mod.skeletonTheme === 'light' ? <LightSkeleton /> : undefined;

  if (mod.layout === 'framed') {
    return (
      <div className="flex flex-col gap-4 p-6 md:p-8 h-full">
        <PageHeader title={mod.label} description={mod.description ?? ''} />
        <div className="flex-1 rounded-xl overflow-hidden border border-border bg-background shadow-sm min-h-[75vh]">
          <ModuleEmbed
            module={mod}
            title={mod.label}
            skeleton={skeleton}
            className="relative w-full h-full min-h-[calc(100vh-12rem)]"
            iframeClassName="rounded-lg"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <ModuleEmbed
        module={mod}
        title={mod.label}
        skeleton={skeleton}
        className="relative w-full h-full"
      />
    </div>
  );
}

/** Skeleton claro (ex.: portal-repasse) para evitar flash escuro antes do módulo carregar. */
function LightSkeleton() {
  return (
    <div className="flex flex-col w-full h-full" style={{ background: '#ffffff' }}>
      {/* Barra de topo simulada */}
      <div
        className="flex items-center gap-3 px-9 shrink-0"
        style={{ height: 64, borderBottom: '1px solid #e6e3dc', background: '#ffffff' }}
      >
        <div className="h-9 w-9 rounded-full animate-pulse" style={{ background: '#e6e3dc' }} />
        <div className="h-4 w-40 rounded animate-pulse"     style={{ background: '#e6e3dc' }} />
        <div className="flex gap-1 ml-6">
          {[72, 64, 80].map((w, i) => (
            <div key={i} className="h-8 rounded animate-pulse" style={{ width: w, background: '#f3f1ec' }} />
          ))}
        </div>
      </div>

      {/* Corpo simulado */}
      <div className="flex flex-1 flex-col" style={{ background: '#fbfaf7', padding: '32px 36px' }}>
        <div className="h-6 w-48 rounded animate-pulse mb-6" style={{ background: '#e6e3dc' }} />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg animate-pulse" style={{ height: 88, background: '#ffffff', border: '1px solid #e6e3dc' }} />
          ))}
        </div>
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e6e3dc', background: '#ffffff' }}>
          <div className="h-10 animate-pulse" style={{ background: '#f3f1ec', borderBottom: '1px solid #e6e3dc' }} />
          {[100, 85, 92, 78].map((w, i) => (
            <div key={i} className="flex items-center gap-4 px-4" style={{ height: 48, borderBottom: '1px solid #f3f1ec' }}>
              <div className="h-3 rounded animate-pulse flex-1" style={{ background: '#e6e3dc', maxWidth: `${w}%`, animationDelay: `${i * 80}ms` }} />
              <div className="h-3 w-20 rounded animate-pulse" style={{ background: '#f3f1ec', animationDelay: `${i * 80 + 40}ms` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

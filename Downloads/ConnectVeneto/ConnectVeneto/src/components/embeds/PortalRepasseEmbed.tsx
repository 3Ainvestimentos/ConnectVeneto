'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import ModuleEmbed from '@/components/embeds/ModuleEmbed';
import { Settings, FlaskConical, X } from 'lucide-react';
import Link from 'next/link';

export default function PortalRepasseEmbed() {
  const [simulateAs, setSimulateAs] = useState('');

  const { user, isSuperAdmin }  = useAuth();
  const { collaborators }       = useCollaborators();

  const isModuleAdmin = useMemo(() => {
    const collab = collaborators.find(c => c.authUid === user?.uid || c.email === user?.email?.toLowerCase());
    return collab?.modulePermissions?.['portal-repasse']?.includes('portal-repasse:manage') ?? false;
  }, [collaborators, user]);

  const portalUsers = useMemo(() =>
    collaborators
      .filter(c => c.email)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [collaborators]
  );

  const simulatedCollab = useMemo(() =>
    collaborators.find(c => c.email === simulateAs),
    [collaborators, simulateAs]
  );

  const devBarHeight   = isSuperAdmin ? 40 : 0;
  const adminBarHeight = (isModuleAdmin && !simulateAs) ? 44 : 0;
  const totalOffset    = devBarHeight + (isSuperAdmin ? 0 : adminBarHeight);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>

      {/* Botão de admin — visível apenas para portal-repasse:manage */}
      {isModuleAdmin && !simulateAs && (
        <Link
          href="/portal-repasse/admin"
          className="absolute right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: '#151E30', border: '1px solid #1E2D4A', color: '#94A3B8', top: devBarHeight + 6 }}
          title="Gerenciar acessos ao Dados Estratégicos"
        >
          <Settings className="w-3.5 h-3.5" />
          Gerenciar Acessos
        </Link>
      )}

      {/* ── Dev toolbar — somente para super admins / desenvolvedores ── */}
      {isSuperAdmin && (
        <div
          className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-3"
          style={{
            height:       devBarHeight,
            background:   simulateAs ? '#581c87' : '#1e1b4b',
            borderBottom: `1px solid ${simulateAs ? '#7e22ce' : '#312e81'}`,
          }}
        >
          <FlaskConical
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: simulateAs ? '#d8b4fe' : '#818cf8' }}
          />
          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: simulateAs ? '#e9d5ff' : '#a5b4fc' }}>
            {simulateAs
              ? `Simulando: ${simulatedCollab?.name ?? simulateAs}`
              : 'Dev'}
          </span>

          <select
            value={simulateAs}
            onChange={e => setSimulateAs(e.target.value)}
            className="text-xs rounded px-2 py-1 ml-1"
            style={{
              background:  '#312e81',
              border:      '1px solid #4338ca',
              color:       '#e0e7ff',
              outline:     'none',
              minWidth:    220,
              maxWidth:    320,
            }}
          >
            <option value="">— Simular como outro usuário —</option>
            {portalUsers.map(c => (
              <option key={c.id} value={c.email}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>

          {simulateAs && (
            <button
              onClick={() => setSimulateAs('')}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded ml-1 hover:opacity-80 transition-opacity"
              style={{ background: '#7e22ce', color: '#f3e8ff', border: '1px solid #9333ea' }}
            >
              <X className="w-3 h-3" />
              Sair
            </button>
          )}
        </div>
      )}

      {/* Embed — trocar simulateAs recarrega o iframe (reloadKey) e re-arma o skeleton */}
      <div
        className="absolute left-0 right-0"
        style={{ top: totalOffset, height: `calc(100% - ${totalOffset}px)` }}
      >
        <ModuleEmbed
          moduleId="portal-repasse"
          title="Dados Estratégicos"
          tokenBody={simulateAs ? { simulateAs } : undefined}
          reloadKey={simulateAs}
          skeleton={<PortalRepasseSkeleton />}
          className="relative w-full h-full"
        />
      </div>
    </div>
  );
}

/** Skeleton com o tema claro do portal-repasse para evitar flash escuro. */
function PortalRepasseSkeleton() {
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

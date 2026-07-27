'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators, type Collaborator, type CollaboratorPermissions } from '@/contexts/CollaboratorsContext';
import { Shield, Check, X, ChevronLeft, Search } from 'lucide-react';
import Link from 'next/link';

const MODULE_ID = 'portal-repasse';

const SUB_PERMISSIONS = [
  { key: 'portal-repasse:tickets:view',   label: 'Ver Correções' },
  { key: 'portal-repasse:tickets:create', label: 'Criar Correções' },
  { key: 'portal-repasse:params:view',    label: 'Ver Parâmetros' },
  { key: 'portal-repasse:params:edit',    label: 'Editar Parâmetros' },
  { key: 'portal-repasse:export',         label: 'Exportar' },
  { key: 'portal-repasse:manage',         label: 'Admin Módulo' },
];

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className="w-7 h-7 rounded-full flex items-center justify-center transition-colors mx-auto"
      style={{
        background: value ? '#10B981' : '#1E2D4A',
        opacity:    disabled ? 0.45 : 1,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        border:     'none',
      }}
      title={value ? 'Remover' : 'Conceder'}
    >
      {value
        ? <Check className="w-3.5 h-3.5 text-white" />
        : <X className="w-3.5 h-3.5" style={{ color: '#64748B' }} />}
    </button>
  );
}

export default function PortalRepasseAdminPage() {
  const { user } = useAuth();
  const { collaborators, loading, updateCollaboratorPermissions, updateModulePermissions } = useCollaborators();
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const currentCollab = useMemo(
    () => collaborators.find(c => c.authUid === user?.uid || c.email === user?.email?.toLowerCase()),
    [collaborators, user],
  );

  const isAuthorized = useMemo(() => {
    if (!currentCollab) return false;
    const modPerms = currentCollab.modulePermissions?.[MODULE_ID] ?? [];
    return modPerms.includes('portal-repasse:manage');
  }, [currentCollab]);

  const filtered = useMemo(
    () => collaborators
      .filter(c =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name)),
    [collaborators, search],
  );

  const handleAccessToggle = async (collab: Collaborator, hasAccess: boolean) => {
    setSaving(collab.id);
    try {
      const newPerms: CollaboratorPermissions = { ...collab.permissions, canViewPortalRepasse: !hasAccess };
      await updateCollaboratorPermissions(collab.id, newPerms);
      if (!hasAccess) {
        const existing = collab.modulePermissions?.[MODULE_ID] ?? [];
        if (!existing.includes('portal-repasse:view')) {
          await updateModulePermissions(collab.id, MODULE_ID, ['portal-repasse:view', ...existing]);
        }
      }
    } finally {
      setSaving(null);
    }
  };

  const handlePermToggle = async (collab: Collaborator, permKey: string, currentValue: boolean) => {
    const key = collab.id + permKey;
    setSaving(key);
    try {
      const existing = collab.modulePermissions?.[MODULE_ID] ?? ['portal-repasse:view'];
      const updated  = currentValue
        ? existing.filter(p => p !== permKey)
        : [...existing.filter(p => p !== permKey), permKey];
      if (!updated.includes('portal-repasse:view')) updated.unshift('portal-repasse:view');
      await updateModulePermissions(collab.id, MODULE_ID, updated);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: '#94A3B8' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: '#1E2D4A', borderTopColor: '#3B82F6' }} />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-64" style={{ color: '#94A3B8' }}>
        <Shield className="w-12 h-12" style={{ color: '#EF4444' }} />
        <p className="text-sm">Você não tem permissão de administrador neste módulo.</p>
        <Link href="/portal-repasse" className="text-sm" style={{ color: '#3B82F6' }}>
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 overflow-auto" style={{ color: '#F1F5F9', minHeight: 'calc(100vh - 3.5rem)' }}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/portal-repasse"
          className="flex items-center gap-1 text-sm transition-colors hover:opacity-80"
          style={{ color: '#94A3B8' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Dados Estratégicos
        </Link>
        <span style={{ color: '#1E2D4A' }}>/</span>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: '#3B82F6' }} />
          <h1 className="text-base font-semibold">Gerenciar Acessos</h1>
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: '#64748B' }}>
        Controle quem pode acessar o Dados Estratégicos e quais abas cada usuário visualiza.
        Alterações entram em vigor no próximo login do colaborador.
      </p>

      {/* Busca */}
      <div className="relative mb-4 w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748B' }} />
        <input
          placeholder="Buscar colaborador…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg"
          style={{ background: '#151E30', border: '1px solid #1E2D4A', color: '#F1F5F9', outline: 'none' }}
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #1E2D4A' }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: '#151E30', borderBottom: '1px solid #1E2D4A' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#94A3B8', minWidth: 220 }}>
                Colaborador
              </th>
              <th className="px-4 py-3 font-medium text-center" style={{ color: '#94A3B8', minWidth: 80 }}>
                Acesso
              </th>
              {SUB_PERMISSIONS.map(p => (
                <th
                  key={p.key}
                  className="px-3 py-3 font-medium text-center"
                  style={{ color: '#94A3B8', fontSize: 11, minWidth: 90 }}
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((collab, i) => {
              const hasAccess = collab.permissions.canViewPortalRepasse;
              const modPerms  = collab.modulePermissions?.[MODULE_ID] ?? [];
              const isSaving  = saving === collab.id;

              return (
                <tr
                  key={collab.id}
                  style={{
                    borderBottom: '1px solid #1E2D4A',
                    background:   i % 2 === 0 ? 'transparent' : 'rgba(21,30,48,0.4)',
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#E2E8F0' }}>{collab.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{collab.email}</div>
                  </td>

                  <td className="px-4 py-3">
                    <Toggle
                      value={hasAccess}
                      disabled={isSaving}
                      onChange={() => handleAccessToggle(collab, hasAccess)}
                    />
                  </td>

                  {SUB_PERMISSIONS.map(perm => {
                    const isActive = modPerms.includes(perm.key);
                    const savingThis = saving === collab.id + perm.key;
                    return (
                      <td key={perm.key} className="px-3 py-3">
                        {hasAccess ? (
                          <Toggle
                            value={isActive}
                            disabled={savingThis}
                            onChange={() => handlePermToggle(collab, perm.key, isActive)}
                          />
                        ) : (
                          <div className="text-center" style={{ color: '#1E2D4A', fontSize: 18 }}>—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs" style={{ color: '#334155' }}>
        {filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''} exibido{filtered.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

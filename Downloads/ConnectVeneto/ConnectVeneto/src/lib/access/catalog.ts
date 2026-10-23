/**
 * Catálogo único das permissões do Connect (`collaborators.permissions`): nome na tela, grupo e o
 * valor padrão para quem ainda não tem perfil. Fonte para a tela de acessos, os perfis (ADR 0005) e
 * os padrões de leitura no navegador.
 */
import type { CollaboratorPermissions } from '@/contexts/CollaboratorsContext';

export type PermissionKey = keyof CollaboratorPermissions;

export interface PermissionGroup {
  id: 'paginas' | 'gestao' | 'sistema';
  label: string;
  items: { key: PermissionKey; label: string; hint?: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'paginas',
    label: 'Páginas',
    items: [
      { key: 'canViewDocuments', label: 'Documentos' },
      { key: 'canViewApplications', label: 'Solicitações' },
      { key: 'canViewRegrasComerciais', label: 'Regras Comerciais' },
      { key: 'canViewBibliotecaComercial', label: 'Biblioteca Comercial' },
      { key: 'canViewConsultaPessoal', label: 'Consulta Pessoal' },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    items: [
      { key: 'canManageContent', label: 'Comunicação', hint: 'Publica em todos os canais e gerencia o conteúdo.' },
      { key: 'canManageTripsBirthdays', label: 'Viagens e aniversários' },
      { key: 'canManageVacation', label: 'Férias', hint: 'Aprova e lança férias.' },
      { key: 'canManageRequests', label: 'Atender solicitações' },
      { key: 'canManageWorkflows', label: 'Fluxos de solicitação', hint: 'Cria e edita os formulários de Solicitações.' },
      { key: 'canManageRegrasComerciais', label: 'Editar Mix de Serviços' },
      { key: 'canManageBibliotecaComercial', label: 'Curar Biblioteca Comercial' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { key: 'canManageSystem', label: 'Administração do sistema', hint: 'Abre /admin.' },
      { key: 'canViewAudit', label: 'Auditoria' },
    ],
  },
];

export const PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/** Só super admin concede (por perfil ou ajuste). */
export const SYSTEM_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.find((g) => g.id === 'sistema')!.items.map((i) => i.key);

export const PERMISSION_LABEL = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))) as Record<PermissionKey, string>;

/** Padrão de quem não tem perfil nem registro: as páginas abertas a toda a empresa. */
export const DEFAULT_PERMISSIONS: CollaboratorPermissions = {
  canManageWorkflows: false,
  canManageRequests: false,
  canManageContent: false,
  canManageTripsBirthdays: false,
  canManageVacation: false,
  canViewAudit: false,
  canManageSystem: false,
  canViewConsultaPessoal: false,
  canViewDocuments: true,
  canViewApplications: true,
  canViewRegrasComerciais: true,
  canManageRegrasComerciais: false,
  // Acervo aberto a toda a empresa, como o repositório interno. Publicar é que continua restrito a
  // quem cura a biblioteca.
  canViewBibliotecaComercial: true,
  canManageBibliotecaComercial: false,
};

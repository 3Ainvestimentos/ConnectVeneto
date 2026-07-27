import type { FeatureFlagKey } from "./features";
import { FEATURE_FLAGS } from "./features";

export type AppModule = {
  id: string;
  name: string;
  description: string;
  featureFlag?: FeatureFlagKey;
  routes: string[];
  permissions: string[];
  enabled: boolean;
};

const allModules: Omit<AppModule, "enabled">[] = [
  {
    id: "dashboard",
    name: "Painel Inicial",
    description: "Tela principal com destaques, calendário e atalhos",
    routes: ["/dashboard"],
    permissions: [],
  },
  {
    id: "applications",
    name: "Solicitações",
    description: "Hub de solicitações e formulários",
    routes: ["/applications"],
    permissions: ["canManageRequests"],
  },
  {
    id: "documents",
    name: "Documentos",
    description: "Repositório de materiais e documentos compartilhados",
    routes: ["/documents"],
    permissions: ["canManageContent"],
  },
  {
    id: "consulta",
    name: "Consulta Pessoal",
    description: "Planilhas Mesa, Cliente e CX configuráveis por colaborador",
    routes: ["/consulta"],
    permissions: [],
  },
  {
    id: "regras-comerciais",
    name: "Regras Comerciais",
    description: "Framework de reuniões e Mix de Serviços da Vêneto",
    featureFlag: "regrasComerciais",
    routes: ["/regras-comerciais"],
    permissions: [],
  },
  {
    id: "bi",
    name: "Painéis",
    description: "Painéis e relatórios embutidos para assessores",
    featureFlag: "businessIntelligence",
    routes: ["/bi"],
    permissions: ["canViewBI"],
  },
  {
    id: "veneto-store",
    name: "Veneto Store",
    description: "Link externo para a loja Veneto",
    featureFlag: "venetoStore",
    routes: [],
    permissions: [],
  },
  {
    id: "travel-birthdays",
    name: "Viagens e Aniversários",
    description: "Gestão de viagens, férias e calendário de aniversários",
    routes: ["/admin/travel-birthdays"],
    permissions: ["canManageTripsBirthdays", "canManageVacation"],
  },
  {
    id: "admin",
    name: "Administração do Sistema",
    description: "Painel de configurações, permissões e auditoria",
    routes: ["/admin", "/audit"],
    permissions: [],
  },
];

export const modules: AppModule[] = allModules.map((mod) => ({
  ...mod,
  enabled: mod.featureFlag ? FEATURE_FLAGS[mod.featureFlag] : true,
}));

/**
 * Módulos externos embarcados via iframe + hub-auth (CONNECTVENETO_MODULE_PROTOCOL.md).
 * Fonte única consumida pelo token route (/api/modules/[moduleId]/token), pelos
 * componentes de embed (ModuleEmbed) e por qualquer proxy server-to-server.
 *
 * As URLs usam vars NEXT_PUBLIC_* para serem resolvíveis tanto no client
 * (postMessage targetOrigin) quanto no server (emissão de token / proxy).
 */
export type EmbeddedModuleConfig = {
  id: string;
  name: string;
  /** Origem do módulo, sem barra final — usada como src do iframe e targetOrigin. */
  url: string;
  /** Rota de bootstrap do embed no módulo. */
  embedPath: string;
  /** Permissões de quem tem acesso padrão. Vazio = acesso só por permissão explícita no Firestore. */
  defaultPermissions: string[];
  /** Permissões concedidas a super admins. */
  adminPermissions: string[];
};

export const EMBEDDED_MODULES: Record<string, EmbeddedModuleConfig> = {
  trackflow: {
    id: 'trackflow',
    name: 'TrackFlow',
    url: (process.env.NEXT_PUBLIC_TRACKFLOW_URL ?? 'https://vnt-trackflow.azurewebsites.net').replace(/\/$/, ''),
    embedPath: '/embed',
    defaultPermissions: ['trackflow:view', 'trackflow:create'],
    adminPermissions: ['trackflow:view', 'trackflow:create', 'trackflow:manage', 'trackflow:admin', 'trackflow:export'],
  },
  'portal-repasse': {
    id: 'portal-repasse',
    name: 'Dados Estratégicos',
    url: (process.env.NEXT_PUBLIC_PORTAL_REPASSE_URL ?? 'https://vnt-repasse.azurewebsites.net').replace(/\/$/, ''),
    embedPath: '/embed',
    defaultPermissions: [],  // acesso por permissão explícita — ver canViewPortalRepasse no Firestore
    adminPermissions: ['portal-repasse:view', 'portal-repasse:manage', 'portal-repasse:export',
                       'portal-repasse:tickets:view', 'portal-repasse:tickets:create',
                       'portal-repasse:params:view', 'portal-repasse:params:edit'],
  },
};

export function getEmbeddedModule(id: string): EmbeddedModuleConfig | undefined {
  return EMBEDDED_MODULES[id];
}

export function getModuleById(id: string): AppModule | undefined {
  return modules.find((m) => m.id === id);
}

export function getEnabledModules(): AppModule[] {
  return modules.filter((m) => m.enabled);
}

export function isRouteEnabled(pathname: string): boolean {
  const matchingModule = modules.find((mod) =>
    mod.routes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
  );
  return matchingModule ? matchingModule.enabled : true;
}

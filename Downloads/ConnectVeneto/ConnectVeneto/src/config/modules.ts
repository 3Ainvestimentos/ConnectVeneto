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
    id: "news",
    name: "Feed de Notícias",
    description: "Publicação e leitura de comunicados internos",
    routes: ["/news"],
    permissions: ["canManageContent"],
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
    id: "labs",
    name: "Labs",
    description: "Área experimental para ferramentas internas",
    featureFlag: "labs",
    routes: ["/labs"],
    permissions: [],
  },
  {
    id: "rankings",
    name: "Rankings e Campanhas",
    description: "Gamificação e campanhas de incentivo",
    featureFlag: "rankings",
    routes: ["/rankings"],
    permissions: ["canViewRankings"],
  },
  {
    id: "bi",
    name: "Business Intelligence",
    description: "Dashboards de BI para assessores",
    featureFlag: "businessIntelligence",
    routes: ["/bi"],
    permissions: ["canViewBI"],
  },
  {
    id: "bi-leaders",
    name: "BI Líderes",
    description: "Dashboards de BI para gestores e líderes",
    featureFlag: "businessIntelligenceLeaders",
    routes: ["/bi-leaders"],
    permissions: ["canViewBILeaders"],
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

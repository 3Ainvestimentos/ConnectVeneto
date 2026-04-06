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
    id: "area-logada",
    name: "Área Logada",
    description: "Relatório virtual, terminal de consulta e área do cliente",
    featureFlag: "areaLogada",
    routes: ["/area-logada"],
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

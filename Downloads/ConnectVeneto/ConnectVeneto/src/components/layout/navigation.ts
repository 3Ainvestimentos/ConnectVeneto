"use client";

import type { ComponentType } from "react";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/config/features";
import type { CollaboratorPermissions } from "@/contexts/CollaboratorsContext";
import {
  Home,
  Table2,
  FolderOpen,
  BookMarked,
  BarChart,
  Workflow,
  ClipboardList,
  LineChart,
  Users,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  external: boolean;
  permission: string | null;
  /** Permissões alternativas: qualquer uma delas também libera o item. */
  altPermissions?: string[];
  featureFlag?: FeatureFlagKey;
};

const allNavItems: AppNavItem[] = [
  { href: "/dashboard", label: "Painel Inicial", icon: Home, external: false, permission: null },
  { href: "/trackflow", label: "TrackFlow", icon: ClipboardList, external: false, permission: null },
  { href: "/consulta", label: "Consulta Pessoal", icon: Table2, external: false, permission: "canViewConsultaPessoal" },
  { href: "/portal-cliente", label: "Portal do Cliente", icon: Users, external: false, permission: "canViewPortalCliente", featureFlag: "portalCliente" },
  { href: "/applications", label: "Solicitações", icon: Workflow, external: false, permission: "canViewApplications" },
  { href: "/documents", label: "Documentos", icon: FolderOpen, external: false, permission: "canViewDocuments", altPermissions: ["canViewBibliotecaComercial", "canManageBibliotecaComercial"] },
  { href: "/regras-comerciais", label: "Regras Comerciais", icon: BookMarked, external: false, permission: "canViewRegrasComerciais", featureFlag: "regrasComerciais" },
  { href: "/bi", label: "Painéis", icon: BarChart, external: false, permission: "canViewBI", featureFlag: "businessIntelligence" },
  { href: "/dados-estrategicos", label: "Dados Estratégicos", icon: LineChart, external: false, permission: "canViewPortalRepasse", featureFlag: "portalRepasse" },
];

export const navItems: AppNavItem[] = allNavItems.filter((item) =>
  item.featureFlag ? FEATURE_FLAGS[item.featureFlag] : true
);

/** Um item aparece no menu se a permissão principal ou qualquer alternativa estiver ligada. */
export function canSeeNavItem(
  item: AppNavItem,
  permissions: CollaboratorPermissions
): boolean {
  if (!item.permission) return true;
  const has = (key: string) => permissions[key as keyof CollaboratorPermissions] === true;
  return has(item.permission) || (item.altPermissions ?? []).some(has);
}

export const noZoomRoutes = [
  "/admin/crm",
  "/admin/strategic-panel",
  "/bi",
  "/personal-panel",
  "/trackflow",
  "/dados-estrategicos",
  "/portal-cliente",
];

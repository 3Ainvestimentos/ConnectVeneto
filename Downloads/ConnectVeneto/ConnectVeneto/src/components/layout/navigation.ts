"use client";

import type { ComponentType } from "react";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/config/features";
import {
  Home,
  Table2,
  FolderOpen,
  BookMarked,
  ShoppingCart,
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
  featureFlag?: FeatureFlagKey;
};

const allNavItems: AppNavItem[] = [
  { href: "/dashboard", label: "Painel Inicial", icon: Home, external: false, permission: null },
  { href: "/trackflow", label: "TrackFlow", icon: ClipboardList, external: false, permission: null },
  { href: "/consulta", label: "Consulta Pessoal", icon: Table2, external: false, permission: "canViewConsultaPessoal" },
  { href: "/portal-cliente", label: "Portal do Cliente", icon: Users, external: false, permission: "canViewPortalCliente", featureFlag: "portalCliente" },
  { href: "/applications", label: "Solicitações", icon: Workflow, external: false, permission: "canViewApplications" },
  { href: "/documents", label: "Documentos", icon: FolderOpen, external: false, permission: "canViewDocuments" },
  { href: "/regras-comerciais", label: "Regras Comerciais", icon: BookMarked, external: false, permission: "canViewRegrasComerciais", featureFlag: "regrasComerciais" },
  { href: "/bi", label: "Painéis", icon: BarChart, external: false, permission: "canViewBI", featureFlag: "businessIntelligence" },
  { href: "/dados-estrategicos", label: "Dados Estratégicos", icon: LineChart, external: false, permission: "canViewPortalRepasse", featureFlag: "portalRepasse" },
  { href: "https://www.venetostore.com.br/", label: "Veneto Store", icon: ShoppingCart, external: true, permission: null, featureFlag: "venetoStore" },
];

export const navItems: AppNavItem[] = allNavItems.filter((item) =>
  item.featureFlag ? FEATURE_FLAGS[item.featureFlag] : true
);

export const noZoomRoutes = [
  "/admin/crm",
  "/admin/strategic-panel",
  "/bi",
  "/personal-panel",
  "/trackflow",
  "/dados-estrategicos",
  "/portal-cliente",
];

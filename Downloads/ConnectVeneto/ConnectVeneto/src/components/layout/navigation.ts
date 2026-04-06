"use client";

import type { ComponentType } from "react";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/config/features";
import {
  Home,
  Table2,
  FolderOpen,
  Scale,
  ShoppingCart,
  BarChart,
  Workflow,
  Lock,
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
  { href: "/consulta", label: "Consulta Pessoal", icon: Table2, external: false, permission: null },
  { href: "/applications", label: "Solicitações", icon: Workflow, external: false, permission: null },
  { href: "/documents", label: "Documentos", icon: FolderOpen, external: false, permission: null },
  { href: "/regras-comerciais", label: "Regras Comerciais", icon: Scale, external: false, permission: null, featureFlag: "regrasComerciais" },
  { href: "/area-logada", label: "Área Logada", icon: Lock, external: false, permission: null, featureFlag: "areaLogada" },
  { href: "/bi", label: "Painéis", icon: BarChart, external: false, permission: "canViewBI", featureFlag: "businessIntelligence" },
  { href: "https://www.venetostore.com.br/", label: "Veneto Store", icon: ShoppingCart, external: true, permission: null, featureFlag: "venetoStore" },
];

export const navItems: AppNavItem[] = allNavItems.filter((item) =>
  item.featureFlag ? FEATURE_FLAGS[item.featureFlag] : true
);

export const noZoomRoutes = [
  "/admin/crm",
  "/admin/strategic-panel",
  "/bi",
  "/consulta",
  "/personal-panel",
  "/area-logada",
];

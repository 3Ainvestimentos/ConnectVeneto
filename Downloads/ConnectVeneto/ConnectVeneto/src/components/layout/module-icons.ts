import type { LucideIcon } from 'lucide-react';
import {
  BarChart,
  BookMarked,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  Headphones,
  Home,
  LayoutDashboard,
  LineChart,
  Newspaper,
  PieChart,
  Puzzle,
  Settings,
  ShieldCheck,
  Table2,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';

/**
 * Ícones disponíveis para itens do menu. O documento em `hubModules` guarda só o
 * nome (`iconName`); a lista é curada para não carregar o pacote inteiro do lucide.
 * Para oferecer um ícone novo, importe-o aqui.
 */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  Home,
  LayoutDashboard,
  ClipboardList,
  Table2,
  Users,
  Workflow,
  FolderOpen,
  BookMarked,
  BarChart,
  LineChart,
  PieChart,
  Briefcase,
  Building2,
  Wallet,
  FileText,
  Newspaper,
  Globe,
  Database,
  Calendar,
  Headphones,
  ShieldCheck,
  Settings,
  Boxes,
  Puzzle,
  ExternalLink,
};

export const MODULE_ICON_NAMES = Object.keys(MODULE_ICONS);

export function getModuleIcon(name: string | undefined): LucideIcon {
  return (name && MODULE_ICONS[name]) || Puzzle;
}

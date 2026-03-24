
"use client";

import Link from 'next/link';
import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from 'next/image';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import logoHeaderDesktop from '../../../docs/PNG/logotipo_vênetoPrancheta_6_upscaled.png';
import logoHeaderMobile from '../../../docs/PNG/logotipo_vênetoPrancheta 9.png';

interface HeaderProps {
  userNav?: React.ReactNode;
  showSidebarTrigger?: boolean;
  showDashboardButton?: boolean;
}

export function Header({ userNav, showSidebarTrigger = true, showDashboardButton = false }: HeaderProps) {
  return (
    <header className={cn("sticky top-0 z-50 flex h-[var(--header-height)] w-full items-center gap-x-4 bg-header text-header-foreground border-b border-border px-4 md:px-6")}>
      {/* Sidebar Trigger for mobile, hidden on md+ */}
      {showSidebarTrigger && (
        <SidebarTrigger className="md:hidden text-header-foreground/80 hover:text-header-foreground" />
      )}

      {/* Logo Section */}
      <div className="flex items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src={logoHeaderDesktop}
            alt="Logo Veneto Family Office"
            width={331}
            height={41}
            priority
            className="hidden md:block h-[41px] w-auto object-contain"
          />
          <Image
            src={logoHeaderMobile}
            alt="Icone Veneto Family Office"
            width={28}
            height={28}
            priority
            className="md:hidden"
          />
        </Link>
      </div>

      {/* Spacer to push user nav to the right */}
      <div className="flex-1" />

      {/* User Navigation */}
      <div className="flex items-center gap-4">
        {showDashboardButton && (
          <Button asChild variant="ghost" className="font-body text-header-foreground/80 hover:bg-transparent hover:font-bold hover:text-header-foreground/80">
            <Link href="/dashboard">Voltar ao Painel Inicial</Link>
          </Button>
        )}
        {userNav}
      </div>
    </header>
  );
}

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCollaborators } from "@/contexts/CollaboratorsContext";
import { findCollaboratorByEmail } from "@/lib/email-utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserCircle,
  Sun,
  Moon,
  LogOut,
  Fingerprint,
  Shield,
  Edit,
} from "lucide-react";

type UserNavProps = {
  onProfileClick: () => void;
  hasPendingRequests: boolean;
  hasPendingTasks: boolean;
};

export function UserNav({
  onProfileClick,
  hasPendingRequests: _hasPendingRequests,
  hasPendingTasks: _hasPendingTasks,
}: UserNavProps) {
  const { user, signOut, loading, isSuperAdmin, permissions } = useAuth();
  const { theme, setTheme } = useTheme();
  const { collaborators } = useCollaborators();

  const currentUserCollaborator = useMemo(() => {
    if (!user) return null;
    return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

  if (loading) return <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />;
  if (!user) return null;

  const displayName = currentUserCollaborator?.name || user.displayName;
  const displayEmail = currentUserCollaborator?.email || user.email;
  const displayPhotoUrl = currentUserCollaborator?.photoURL || user.photoURL || undefined;

  const hasAdminPanels =
    permissions.canManageContent ||
    permissions.canManageWorkflows ||
    isSuperAdmin;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={displayPhotoUrl} alt={displayName || "User Avatar"} />
            <AvatarFallback>{displayName ? displayName.charAt(0).toUpperCase() : <UserCircle size={24} />}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none font-headline">{displayName || "Usuário"}</p>
            <p className="text-xs leading-none text-muted-foreground font-body">{displayEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onProfileClick} className="cursor-pointer font-body">
          <UserCircle className="mr-2 h-4 w-4" />
          <span>Meu Perfil</span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "light" && <Sun className="mr-2 h-4 w-4" />}
            {theme === "dark" && <Moon className="mr-2 h-4 w-4" />}
            <span>Tema</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark")}>
                <DropdownMenuRadioItem value="light">
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Claro</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Escuro</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {hasAdminPanels && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Painéis de controle</DropdownMenuLabel>
              {permissions.canManageContent && (
                <DropdownMenuItem asChild>
                  <Link href="/admin/content" className="cursor-pointer font-body">
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Conteúdo</span>
                  </Link>
                </DropdownMenuItem>
              )}
              {isSuperAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/audit" className="cursor-pointer font-body text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Fingerprint className="mr-2 h-4 w-4" />
                      <span>Auditoria</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer font-body text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Sistema</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="cursor-pointer font-body">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

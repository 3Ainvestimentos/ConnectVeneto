"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ManageMixServicosSlides } from "@/components/admin/ManageMixServicosSlides";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tela de administração do carrossel "Apresentação — Mix de Serviços".
 *
 * Guarda própria (não usa `AdminGuard`): quem tem `canManageRegrasComerciais` não é
 * administrador geral e não deve alcançar os outros painéis.
 */
export default function AdminRegrasComerciaisPage() {
  const { user, loading, permissions, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  const canManage = isSuperAdmin || permissions.canManageRegrasComerciais;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!canManage) {
      router.replace("/regras-comerciais");
    } else {
      setIsAuthorized(true);
    }
  }, [user, loading, canManage, router]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8 admin-panel">
      <PageHeader
        title="Regras Comerciais — Apresentação"
        description="Gerencie as imagens do carrossel do Mix de Serviços."
      />
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/regras-comerciais">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Regras Comerciais
        </Link>
      </Button>
      <ManageMixServicosSlides />
    </div>
  );
}

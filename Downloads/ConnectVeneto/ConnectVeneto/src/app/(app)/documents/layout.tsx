"use client";

import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, permissions } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Quem só tem a Biblioteca Comercial também entra: a página abre direto na aba dela.
  const canViewAnyLibrary =
    permissions.canViewDocuments ||
    permissions.canViewBibliotecaComercial ||
    permissions.canManageBibliotecaComercial;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (!canViewAnyLibrary) {
        router.replace("/dashboard");
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, loading, canViewAnyLibrary, router]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return <div className="flex-grow h-[calc(100vh-var(--header-height))]">{children}</div>;
}

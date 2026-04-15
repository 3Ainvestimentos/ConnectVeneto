"use client";

import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegrasComerciaisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, permissions } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (!permissions.canViewRegrasComerciais) {
        router.replace("/dashboard");
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, loading, permissions.canViewRegrasComerciais, router]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return <div className="flex-grow h-[calc(100vh-var(--header-height))]">{children}</div>;
}

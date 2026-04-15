"use client";

import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DatePickerWithRange } from '@/shared/components/ui/date-picker-with-range';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { AuditProvider, useAudit } from '@/contexts/AuditContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function AuditLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isSuperAdmin, permissions } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { dateRange, setDateRange } = useAudit();
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleTabChange = (value: string) => {
    router.push(value);
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setIsAuthorized(false);
        router.replace('/login');
      } else if (!isSuperAdmin && !permissions.canViewAudit) {
        setIsAuthorized(false);
        router.replace('/dashboard');
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, loading, isSuperAdmin, permissions.canViewAudit, router]);

  // Determine the active tab based on the current path
  let activeTab = "/audit";
  if (pathname.includes('/content-interaction')) {
    activeTab = "/audit/content-interaction";
  }


  if (loading || !isAuthorized) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader 
        title="Painel de Auditoria" 
        description="Monitore eventos, uso e engajamento da plataforma."
        actions={<DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
      />
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-2">
              <TabsTrigger value="/audit">Logins</TabsTrigger>
              <TabsTrigger value="/audit/content-interaction">Conteúdos</TabsTrigger>
          </TabsList>
      </Tabs>
      <div className="pt-4">
          {children}
      </div>
    </div>
  );
}


export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    return (
        <AuditProvider>
            <AuditLayoutContent>{children}</AuditLayoutContent>
        </AuditProvider>
    )
}

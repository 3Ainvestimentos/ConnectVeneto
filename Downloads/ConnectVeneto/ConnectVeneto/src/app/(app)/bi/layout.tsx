
"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function BILayout({
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
        router.replace('/login');
      } else if (!permissions.canViewBI) {
        router.replace('/dashboard');
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, loading, permissions.canViewBI, router]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex-grow h-[calc(100vh-var(--header-height))]">
        {children}
    </div>
  );
}

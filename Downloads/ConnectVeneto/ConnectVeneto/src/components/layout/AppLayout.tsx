"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Header } from './Header';
import Link from 'next/link';
import { LogOut, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import FAQModal from '@/components/guides/FAQModal';
import ProfileModal from '../applications/ProfileModal';
import { useWorkflows } from '@/contexts/WorkflowsContext';
import { toast } from '@/hooks/use-toast';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { addDocumentToCollection, updateDocumentInCollection } from '@/lib/firestore-service';
import { useApplications } from '@/contexts/ApplicationsContext';
import PollTrigger from '@/components/polls/PollTrigger';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { TermsOfUseModal } from '../auth/TermsOfUseModal';
import { DailyRssModal } from '../rss/DailyRssModal';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { getCollaboratorUserId } from '@/contexts/CollaboratorsContext';
import logoSidebar from '../../../docs/PNG/logotipo_vênetoPrancheta 1.png';
import { UserNav } from './UserNav';
import { navItems, noZoomRoutes } from './navigation';
import { bootstrapTrace } from '@/lib/bootstrap-trace';


export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, permissions, isSuperAdmin } = useAuth();
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const { requests, loading: workflowsLoading } = useWorkflows();
  const { workflowDefinitions } = useApplications();
  const router = useRouter();
  const pathname = usePathname();
  const { setOpen: setSidebarOpen } = useSidebar();
  
  const isFullscreenPage = false;
  const shouldApplyContentZoom = !noZoomRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const currentUserCollab = useMemo(() => {
    if (!user) return null;
    return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

  useEffect(() => {
    if (loading || collaboratorsLoading || settingsLoading || isSuperAdmin) return;
    
    // Funcionalidade de Termos de Uso desativada
  }, [currentUserCollab, settings.termsVersion, loading, collaboratorsLoading, settingsLoading, isSuperAdmin]);
  
  const handleAcceptTerms = async () => {
    if (!currentUserCollab) return false;
    try {
        await updateDocumentInCollection('collaborators', currentUserCollab.id, {
            acceptedTermsVersion: settings.termsVersion
        });
        setShowTermsModal(false);
        toast({ title: "Termos aceitos!", description: "Obrigado! Você já pode acessar a plataforma."});
        return true;
    } catch {
        toast({ title: "Erro", description: "Não foi possível salvar sua confirmação. Tente novamente.", variant: 'destructive'});
        return false;
    }
  };

  const handleDeclineTerms = () => {
      signOut();
  };

  const hasPendingRequests = useMemo(() => {
    if (!user || workflowsLoading || !requests.length || !permissions.canManageRequests) return false;
    
    const currentUserCollab = findCollaboratorByEmail(collaborators, user?.email);
    if (!currentUserCollab) return false;

    return requests.some(req => {
        if (req.isArchived) return false;
        
        const isOwnerWithUnassignedTask = (req.ownerEmail === user.email) && !req.assignee;
        
        return isOwnerWithUnassignedTask;
    });
  }, [user, requests, workflowsLoading, permissions.canManageRequests, collaborators]);
  
  const hasPendingTasks = useMemo(() => {
    if (!user || workflowsLoading || !requests.length) return false;
    const currentUserCollab = findCollaboratorByEmail(collaborators, user.email);
    if (!currentUserCollab) return false;
    const currentUserId = getCollaboratorUserId(currentUserCollab);
    if (!currentUserId) return false;
    
    const hasNewTask = requests.some(req => {
      if (req.isArchived || req.assignee?.id !== currentUserId) {
        return false;
      }
      const definition = workflowDefinitions.find(d => d.name === req.type);
      if (!definition || !definition.statuses || definition.statuses.length === 0) {
        return false;
      }
      const initialStatusId = definition.statuses[0].id;
      return req.status === initialStatusId;
    });

    if(hasNewTask) return true;

    const hasActionRequest = requests.some(req => {
      if (req.isArchived) return false;
      const actionRequestsForStatus = req.actionRequests?.[req.status] || [];
      return actionRequestsForStatus.some(
        ar => ar.userId === currentUserId && ar.status === 'pending'
      );
    });

    return hasActionRequest;
  }, [user, requests, workflowsLoading, collaborators, workflowDefinitions]);


  // Page view logging
  useEffect(() => {
    if (user && pathname) {
        const currentUserCollab = findCollaboratorByEmail(collaborators, user.email);
        const currentUserId = getCollaboratorUserId(currentUserCollab);
        if (currentUserCollab && currentUserId) {
            addDocumentToCollection('audit_logs', {
                eventType: 'page_view',
                userId: currentUserId,
                userName: currentUserCollab.name,
                timestamp: new Date().toISOString(),
                details: {
                    path: pathname,
                }
            }).catch(console.error); // Log silently without disturbing user
        }
    }
  }, [pathname, user, collaborators]);


  // Inactivity Logout Logic
  const handleSignOut = useCallback(() => {
    signOut().then(() => {
        toast({
            title: "Sessão Expirada",
            description: "Você foi desconectado por inatividade. Por favor, faça login novamente.",
        });
    });
  }, [signOut]);

  useEffect(() => {
      if (typeof window === 'undefined') return;

      const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours — must remain >= 12h per session policy
      let inactivityTimer: NodeJS.Timeout;

      const resetTimer = () => {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(handleSignOut, INACTIVITY_TIMEOUT);
      };

      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
      activityEvents.forEach(event => window.addEventListener(event, resetTimer));

      resetTimer(); // Initialize timer

      return () => {
          clearTimeout(inactivityTimer);
          activityEvents.forEach(event => window.removeEventListener(event, resetTimer));
      };
  }, [handleSignOut]);

  useEffect(() => {
    bootstrapTrace('app_layout_auth_state', {
      loading,
      hasUser: !!user,
      path: pathname,
    });
  }, [loading, user, pathname]);

  useEffect(() => {
    if (!loading && !user) {
      bootstrapTrace('app_layout_redirect_login', { path: pathname });
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
     return (
        <div className="flex h-screen w-screen items-center justify-center">
          <LoadingSpinner />
        </div>
     );
  }

  if (!user) {
    return null;
  }
  
  const handleLinkClick = () => {
    if (window.innerWidth < 768) { // md breakpoint from tailwind
        setSidebarOpen(false);
    }
  };


  return (
    <div className="flex min-h-screen flex-col">
      <Header userNav={<UserNav onProfileClick={() => setIsProfileModalOpen(true)} hasPendingRequests={hasPendingRequests} hasPendingTasks={hasPendingTasks} />} showSidebarTrigger={!isFullscreenPage} showDashboardButton={isFullscreenPage} />
      <div className="flex flex-1"> 
        {!isFullscreenPage && (
          <Sidebar collapsible="icon" variant="sidebar"> 
            <SidebarContent className="flex-1 p-2">
              <div className="mb-4 px-2 py-1 group-data-[state=collapsed]/sidebar-wrapper:hidden">
                <Link href="/dashboard" onClick={handleLinkClick} className="flex items-center justify-center rounded-md p-2 hover:bg-muted">
                  <Image src={logoSidebar} alt="Logo Veneto Family Office" width={140} height={36} className="h-auto w-auto max-h-8" priority />
                </Link>
              </div>
              <SidebarMenu>
                {navItems.map((item) => {
                  if (item.permission && !permissions[item.permission as keyof typeof permissions]) {
                    return null;
                  }
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={!item.external && (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)))}
                        tooltip={{children: item.label, className: "font-body"}}
                        onClick={handleLinkClick}
                        className="font-body"
                      >
                       <Link
                          href={item.href}
                          {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className="p-2 mt-auto">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={{ children: "Guias e FAQ", className: "font-body" }}
                    onClick={() => {
                        handleLinkClick();
                        setIsFaqModalOpen(true);
                    }}
                    className="font-body"
                  >
                    <HelpCircle />
                    <span>Guias e FAQ</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton onClick={signOut} tooltip={{ children: "Sair", className: "font-body" }} className="font-body">
                    <LogOut />
                    <span>Sair</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
        )}
        <main className={cn("flex-1", !isFullscreenPage && "md:ml-[var(--sidebar-width-icon)]")}>
          {shouldApplyContentZoom ? (
            <div style={{ zoom: "0.85" }}>
              {children}
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      <PollTrigger />
      <DailyRssModal forceOpen={false} />
      <FAQModal open={isFaqModalOpen} onOpenChange={setIsFaqModalOpen} />
      <ProfileModal open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
      <TermsOfUseModal
        isOpen={showTermsModal}
        termsUrl={settings.termsUrl}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
      />
    </div>
  );
}


// Main AppLayout component that wraps SidebarProvider
export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}> 
      <AppLayout>{children}</AppLayout>
    </SidebarProvider>
  )
}

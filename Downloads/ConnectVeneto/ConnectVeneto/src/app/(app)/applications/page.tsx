"use client";

import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { getIcon } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { useApplications, WorkflowDefinition } from '@/contexts/ApplicationsContext';
import { Separator } from '@/components/ui/separator';
import MyRequests from '@/components/applications/MyRequests';
import WorkflowSubmissionModal from '@/components/applications/WorkflowSubmissionModal';
import { useAuth } from '@/contexts/AuthContext';
import { WorkflowGroupModal } from '@/components/applications/WorkflowGroupModal';
import { useWorkflowAreas } from '@/contexts/WorkflowAreasContext';
import { getCollaboratorUserId } from '@/contexts/CollaboratorsContext';

interface GroupedWorkflows {
  [area: string]: WorkflowDefinition[];
}

export default function ApplicationsPage() {
  const { currentUserCollab, permissions, isSuperAdmin } = useAuth();
  const { workflowDefinitions } = useApplications();
  const { workflowAreas } = useWorkflowAreas();

  const [activeWorkflow, setActiveWorkflow] = React.useState<WorkflowDefinition | null>(null);
  const [activeGroup, setActiveGroup] = React.useState<WorkflowDefinition[] | null>(null);

  const groupedWorkflows = React.useMemo(() => {
    if (!currentUserCollab || !workflowAreas.length) return {};

    // Verifica se o usuário é admin de workflows ou super admin
    const isAdmin = permissions.canManageWorkflows || isSuperAdmin;

    const accessibleWorkflows = workflowDefinitions.filter(def => {
      // Admins têm acesso a todos os workflows automaticamente
      if (isAdmin) {
        return true;
      }
      
      // Para não-admins, verifica allowedUserIds
      if (!def.allowedUserIds || def.allowedUserIds.includes('all')) {
        return true;
      }
      return def.allowedUserIds.includes(getCollaboratorUserId(currentUserCollab) || '');
    });

    const groups: GroupedWorkflows = {};
    // Use the sorted order from workflowAreas to build the groups
    workflowAreas.forEach(area => {
      const workflowsForArea = accessibleWorkflows.filter(def => def.areaId === area.id);
      if (workflowsForArea.length > 0) {
        // Sort the workflows inside the group based on the area's custom order
        workflowsForArea.sort((a, b) => {
          const orderA = area.workflowOrder?.indexOf(a.id) ?? -1;
          const orderB = area.workflowOrder?.indexOf(b.id) ?? -1;
          if (orderA !== -1 && orderB !== -1) return orderA - orderB;
          if (orderA !== -1) return -1;
          if (orderB !== -1) return 1;
          return (a?.name || '').localeCompare(b?.name || ''); // Fallback sort
        });
        groups[area.name] = workflowsForArea;
      }
    });

    return groups;
  }, [workflowDefinitions, currentUserCollab, workflowAreas, permissions.canManageWorkflows, isSuperAdmin]);

  const sortedGroupKeys = React.useMemo(() => {
    // The keys should already be in a reasonable order if they come from the sorted workflowAreas
    return Object.keys(groupedWorkflows);
  }, [groupedWorkflows]);

  const handleAppClick = (group: WorkflowDefinition[]) => {
    if (group.length === 1) {
      setActiveWorkflow(group[0]);
    } else {
      setActiveGroup(group);
    }
  };

  const handleWorkflowSelectedFromGroup = (workflow: WorkflowDefinition) => {
    setActiveGroup(null);
    setActiveWorkflow(workflow);
  };

  const handleCloseModal = () => {
    setActiveWorkflow(null);
  };

  const getAreaIcon = (areaName: string) => {
      const area = workflowAreas.find(a => a.name === areaName);
      return area?.icon || 'FolderOpen';
  };

  return (
    <>
      <div className="space-y-8 p-6 md:p-8">
        <div>
          <PageHeader 
            title="Solicitações" 
            description="Inicie processos e acesse as ferramentas da empresa."
          />
          <div className="flex flex-wrap justify-center gap-4">
            {sortedGroupKeys.map((area) => {
              const group = groupedWorkflows[area];
              const representativeIcon = getAreaIcon(area);
              const Icon = getIcon(representativeIcon);
              const content = (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Icon className="mb-2 h-7 w-7 text-muted-foreground" />
                  <span className="font-semibold font-body text-sm text-card-foreground">{area}</span>
                </div>
              );

              return (
                <Card 
                  key={area}
                  className="h-32 w-48 flex items-center justify-center hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleAppClick(group)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAppClick(group)}
                  tabIndex={0}
                >
                  <CardContent className="p-0 h-full w-full">{content}</CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        
        <Separator />
        
        <MyRequests />

      </div>
      
      {activeWorkflow && (
        <WorkflowSubmissionModal
            open={!!activeWorkflow}
            onOpenChange={handleCloseModal}
            workflowDefinition={activeWorkflow}
        />
      )}

      {activeGroup && (
        <WorkflowGroupModal
          open={!!activeGroup}
          onOpenChange={() => setActiveGroup(null)}
          areaName={activeGroup[0] ? (workflowAreas.find(a => a.id === activeGroup[0].areaId)?.name || 'Workflows') : 'Workflows'}
          group={activeGroup}
          onWorkflowSelect={handleWorkflowSelectedFromGroup}
        />
      )}
    </>
  );
}

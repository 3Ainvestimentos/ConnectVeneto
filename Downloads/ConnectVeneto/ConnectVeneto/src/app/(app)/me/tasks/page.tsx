
"use client";

import React, { useState, useMemo } from 'react';
import { useWorkflows, WorkflowRequest } from '@/contexts/WorkflowsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Inbox, ShieldCheck, UserCheck } from 'lucide-react';
import { RequestApprovalModal } from '@/components/requests/RequestApprovalModal';
import { useApplications } from '@/contexts/ApplicationsContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';

export default function MyTasksPage() {
    const { user, loading: userLoading } = useAuth();
    const { requests, loading: requestsLoading } = useWorkflows();
    const { collaborators, loading: collabLoading } = useCollaborators();
    const { workflowDefinitions } = useApplications();
    const [selectedRequest, setSelectedRequest] = useState<WorkflowRequest | null>(null);

    const loading = userLoading || requestsLoading || collabLoading;

    const { assignedTasks, actionTasks } = useMemo(() => {
        if (loading || !user) return { assignedTasks: [], actionTasks: [] };
        
        const currentUserCollab = findCollaboratorByEmail(collaborators, user.email);
        if (!currentUserCollab) return { assignedTasks: [], actionTasks: [] };

        const myAssignedTasks: WorkflowRequest[] = [];
        const myActionTasks: WorkflowRequest[] = [];

        requests.forEach(req => {
            if (req.isArchived) return;

            // Check for assigned tasks tests
            if (req.assignee?.id === getCollaboratorUserId(currentUserCollab)) {
                myAssignedTasks.push(req);
            }
            
            // Check for pending action requests
            const actionRequestsForStatus = req.actionRequests?.[req.status] || [];
            const isUserActionPending = actionRequestsForStatus.some(
                ar => ar.userId === getCollaboratorUserId(currentUserCollab) && ar.status === 'pending'
            );

            if (isUserActionPending) {
                myActionTasks.push(req);
            }
        });
        
        return { assignedTasks: myAssignedTasks, actionTasks: myActionTasks };

    }, [requests, user, collaborators, loading]);

    const getStatusLabel = (request: WorkflowRequest) => {
        const definition = workflowDefinitions.find(d => d.name === request.type);
        const status = definition?.statuses.find(s => s.id === request.status);
        return status?.label || request.status;
    };

    const renderSkeleton = () => (
         <Card>
            <CardHeader>
                <CardTitle><Skeleton className="h-7 w-48" /></CardTitle>
                <CardDescription><Skeleton className="h-4 w-64" /></CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            </CardContent>
        </Card>
    );
    
    const TasksTable = ({ title, description, tasks, icon }: { title: string; description: string; tasks: WorkflowRequest[]; icon: React.ElementType }) => {
        const Icon = icon;
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Icon className="h-6 w-6" />
                        {title}
                    </CardTitle>
                    <CardDescription>
                        {tasks.length} {description}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tasks.length > 0 ? (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Solicitante</TableHead>
                                        <TableHead>Data de Submissão</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tasks.map((req) => (
                                        <TableRow key={req.id}>
                                            <TableCell className="font-mono text-muted-foreground text-xs">{req.requestId}</TableCell>
                                            <TableCell className="font-medium">{req.type}</TableCell>
                                            <TableCell>{req.submittedBy.userName}</TableCell>
                                            <TableCell>{format(parseISO(req.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-semibold">
                                                    {getStatusLabel(req)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(req)} className="hover:bg-muted">
                                                    <Eye className="h-5 w-5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-10 px-6 border-2 border-dashed rounded-lg">
                            <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-medium text-foreground">Nenhuma tarefa encontrada</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Você não possui nenhuma pendência deste tipo no momento.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    if (loading) {
        return (
             <div className="space-y-6 p-6 md:p-8">
                <PageHeader 
                    title="Minhas Tarefas/Ações"
                    description="Gerencie as solicitações e ações pendentes atribuídas a você."
                />
                {renderSkeleton()}
                {renderSkeleton()}
            </div>
        )
    }

    return (
        <>
            <div className="space-y-6 p-6 md:p-8">
                <PageHeader 
                    title="Minhas Tarefas/Ações"
                    description="Gerencie as solicitações e ações pendentes atribuídas a você."
                />
                
                <div className="space-y-6">
                    <TasksTable
                        title="Ações Pendentes"
                        description="solicitação(ões) aguardando sua aprovação, ciência ou execução."
                        tasks={actionTasks}
                        icon={ShieldCheck}
                    />

                    <TasksTable
                        title="Tarefas Atribuídas"
                        description="tarefa(s) atribuída(s) a você para processamento."
                        tasks={assignedTasks}
                        icon={UserCheck}
                    />
                </div>
            </div>
            
            <RequestApprovalModal
                request={selectedRequest}
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
            />
        </>
    );
}



"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useWorkflows, WorkflowRequest } from '@/contexts/WorkflowsContext';
import { useApplications } from '@/contexts/ApplicationsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mailbox, Eye, Filter, FileDown, Users, Archive, Loader2 } from 'lucide-react';
import { RequestApprovalModal } from './RequestApprovalModal';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Papa from 'papaparse';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { findCollaboratorByEmail, emailsMatch } from '@/lib/email-utils';
import { toast } from '@/hooks/use-toast';


export function ManageRequests() {
    const { user, permissions } = useAuth();
    const { requests, loading, markRequestsAsViewedBy, archiveRequestMutation } = useWorkflows();
    const { workflowDefinitions } = useApplications();
    const { collaborators } = useCollaborators();
    const [selectedRequest, setSelectedRequest] = useState<WorkflowRequest | null>(null);
    const [assigneeFilter, setAssigneeFilter] = useState('all'); // 'all', 'unassigned', or collaborator idVeneto
    
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    
    useEffect(() => {
        const currentUserCollab = findCollaboratorByEmail(collaborators, user?.email);
        const currentUserId = getCollaboratorUserId(currentUserCollab);
        if (permissions.canManageRequests && currentUserId) {
            const ownedRequestIds = requests
                .filter(req => emailsMatch(req.ownerEmail, user?.email))
                .map(req => req.id);
            markRequestsAsViewedBy(currentUserId, ownedRequestIds);
        }
    }, [user, permissions.canManageRequests, collaborators, markRequestsAsViewedBy, requests]);

    const { activeRequests, archivedRequests } = useMemo(() => {
      if (!user) return { activeRequests: [], archivedRequests: [] };
      const owned = requests.filter(req => emailsMatch(req.ownerEmail, user.email));
      return {
          activeRequests: owned.filter(req => !req.isArchived),
          archivedRequests: owned.filter(req => req.isArchived)
      }
    }, [requests, user]);

    const availableStatuses = useMemo(() => {
      const statusMap = new Map<string, string>();
      activeRequests.forEach(req => {
        const definition = workflowDefinitions.find(d => d.name === req.type);
        const statusDef = definition?.statuses.find(s => s.id === req.status);
        if (statusDef && !statusMap.has(statusDef.id)) {
            statusMap.set(statusDef.id, statusDef.label);
        }
      });
      return Array.from(statusMap.entries()).map(([id, label]) => ({ id, label }));
    }, [activeRequests, workflowDefinitions]);

    const availableAssignees = useMemo(() => {
      const assigneeIds = new Set<string>();
      activeRequests.forEach(req => {
        if (req.assignee) {
          assigneeIds.add(req.assignee.id);
        }
      });
      return collaborators.filter(c => {
        const collaboratorId = getCollaboratorUserId(c);
        return collaboratorId ? assigneeIds.has(collaboratorId) : false;
      });
    }, [activeRequests, collaborators]);


    const filteredActiveRequests = useMemo(() => {
        let filtered = [...activeRequests];

        if (statusFilter.length > 0) {
            filtered = filtered.filter(req => statusFilter.includes(req.status));
        }
        if (assigneeFilter === 'unassigned') {
            filtered = filtered.filter(req => !req.assignee);
        } else if (assigneeFilter !== 'all') {
            filtered = filtered.filter(req => req.assignee?.id === assigneeFilter);
        }
        return filtered;
    }, [activeRequests, statusFilter, assigneeFilter]);

    const handleStatusFilterChange = (statusId: string) => {
        setStatusFilter(prev => 
            prev.includes(statusId) 
                ? prev.filter(s => s !== statusId) 
                : [...prev, statusId]
        );
    };

    const getStatusLabel = (request: WorkflowRequest) => {
        const definition = workflowDefinitions.find(d => d.name === request.type);
        const status = definition?.statuses.find(s => s.id === request.status);
        return status?.label || request.status;
    };
    
    const handleArchiveRequest = async (id: string) => {
        try {
            await archiveRequestMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "A solicitação foi arquivada." });
        } catch {
            toast({ title: "Erro ao Arquivar", description: "Não foi possível arquivar a solicitação.", variant: "destructive" });
        }
    }

    const handleExportCSV = (requestsToExport: WorkflowRequest[]) => {
        const dataToExport = requestsToExport.map(req => {
            const flatFormData = Object.entries(req.formData).map(([key, value]) => {
                if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
                    return { [key]: `${value.from} a ${value.to}` };
                }
                return { [key]: value };
            }).reduce((acc, current) => ({ ...acc, ...current }), {});

            return {
                ID_Solicitacao: req.requestId,
                Tipo: req.type,
                Status: getStatusLabel(req),
                Responsavel: req.assignee?.name || 'Não atribuído',
                Solicitante: req.submittedBy.userName,
                Email_Solicitante: req.submittedBy.userEmail,
                Data_Submissao: format(parseISO(req.submittedAt), "dd/MM/yyyy HH:mm:ss"),
                ...flatFormData
            };
        });

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_solicitacoes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const RequestTable = ({ tableRequests, isArchived = false }: { tableRequests: WorkflowRequest[], isArchived?: boolean }) => {
        if (loading) {
          return (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          );
        }

        if (tableRequests.length === 0) {
            return (
                 <div className="text-center py-10 px-6 border-2 border-dashed rounded-lg">
                    <Mailbox className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium text-foreground">Caixa vazia</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Nenhuma solicitação encontrada para os filtros atuais.
                    </p>
                </div>
            )
        }

        return (
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead>Data de Submissão</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tableRequests.map((req) => (
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
                                <TableCell>
                                    {req.assignee ? (
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback className="text-xs">
                                                    {(req.assignee.name && typeof req.assignee.name === 'string' && req.assignee.name.length > 0) ? req.assignee.name.charAt(0) : '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm">{req.assignee.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Não atribuído</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {!isArchived && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={archiveRequestMutation.isPending && archiveRequestMutation.variables === req.id} className="hover:bg-muted">
                                                {archiveRequestMutation.isPending && archiveRequestMutation.variables === req.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Archive className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Arquivar Solicitação?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação irá remover a solicitação da sua caixa de entrada, mas ela continuará existindo no sistema para fins de auditoria. Tem certeza que deseja arquivar?
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleArchiveRequest(req.id)}>Arquivar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(req)} className="hover:bg-muted">
                                        <Eye className="h-5 w-5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
        );
    };

    const getAssigneeFilterLabel = () => {
        if (assigneeFilter === 'all') return 'Todos';
        if (assigneeFilter === 'unassigned') return 'Não Atribuídos';
        const collab = collaborators.find(c => getCollaboratorUserId(c) === assigneeFilter);
        return collab ? collab.name : 'Desconhecido';
    }


    return (
        <>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                             <div>
                                <CardTitle>Caixa de Entrada</CardTitle>
                                <CardDescription>
                                    {filteredActiveRequests.length} solicitação(ões) aguardando sua gestão. Apenas workflows de sua propriedade são exibidos aqui.
                                </CardDescription>
                            </div>
                             <div className="flex flex-wrap gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline">
                                            <Users className="mr-2 h-4 w-4" />
                                            Responsável: {getAssigneeFilterLabel()}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Filtrar por Responsável</DropdownMenuLabel>
                                        <DropdownMenuRadioGroup value={assigneeFilter} onValueChange={setAssigneeFilter}>
                                            <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="unassigned">Não Atribuídos</DropdownMenuRadioItem>
                                            {availableAssignees.length > 0 && <DropdownMenuSeparator />}
                                            {availableAssignees.map(c => (
                                                <DropdownMenuRadioItem key={c.id} value={getCollaboratorUserId(c) || c.id}>
                                                    {c.name}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline">
                                            <Filter className="mr-2 h-4 w-4" />
                                            Filtrar por Status
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Status</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {availableStatuses.map(status => (
                                            <DropdownMenuCheckboxItem
                                                key={status.id}
                                                checked={statusFilter.includes(status.id)}
                                                onCheckedChange={() => handleStatusFilterChange(status.id)}
                                            >
                                                {status.label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button onClick={() => handleExportCSV(filteredActiveRequests)} disabled={filteredActiveRequests.length === 0} className="bg-admin-primary hover:bg-admin-primary/90">
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Exportar CSV
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <RequestTable tableRequests={filteredActiveRequests} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Solicitações Arquivadas</CardTitle>
                        <CardDescription>
                            {archivedRequests.length} solicitação(ões) arquivada(s).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RequestTable tableRequests={archivedRequests} isArchived={true} />
                    </CardContent>
                </Card>
            </div>
            
            <RequestApprovalModal
                request={selectedRequest}
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
            />
        </>
    );
}

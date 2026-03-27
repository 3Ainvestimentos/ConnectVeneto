
"use client";

import React, { useState, useMemo } from 'react';
import { useWorkflows, WorkflowRequest } from '@/contexts/WorkflowsContext';
import { useApplications } from '@/contexts/ApplicationsContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ListChecks, Search, FileDown, ChevronUp, ChevronDown, Archive, Eye, Filter, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { RequestApprovalModal } from '../requests/RequestApprovalModal';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { findCollaboratorByEmail, normalizeEmail } from '@/lib/email-utils';

type SortKey = 'requestId' | 'type' | 'status' | 'submittedBy' | 'assignee' | 'ownerEmail' | 'submittedAt' | 'isArchived' | '';
type SortDirection = 'asc' | 'desc';

export function AllRequestsView() {
    const { requests, loading, archiveRequestMutation } = useWorkflows();
    const { workflowDefinitions } = useApplications();
    const { collaborators } = useCollaborators();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [showArchived, setShowArchived] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<WorkflowRequest | null>(null);
    const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
    const [attentionFilter, setAttentionFilter] = useState(false);


    const uniqueOwners = useMemo(() => {
        const ownerEmails = new Set(requests.map(req => normalizeEmail(req.ownerEmail)).filter(Boolean));
        return collaborators.filter(c => {
            const normalized = normalizeEmail(c.email);
            return normalized && ownerEmails.has(normalized);
        });
    }, [requests, collaborators]);

    const filteredAndSortedRequests = useMemo(() => {
        let items = [...requests];

        if (!showArchived) {
            items = items.filter(req => !req.isArchived);
        }

        if (attentionFilter) {
            items = items.filter(req => {
                const isUnassignedForTooLong = !req.assignee && differenceInHours(new Date(), parseISO(req.submittedAt)) > 24;
                const hasOverdueActionRequest = (req.actionRequests?.[req.status] || []).some(ar =>
                    ar.status === 'pending' && differenceInHours(new Date(), parseISO(ar.requestedAt)) > 24
                );
                return !req.isArchived && (isUnassignedForTooLong || hasOverdueActionRequest);
            });
        }


        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            items = items.filter(req => {
                const requestId = req.requestId || '';
                const type = (req.type && typeof req.type === 'string') ? req.type.toLowerCase() : '';
                const userName = (req.submittedBy?.userName && typeof req.submittedBy.userName === 'string') ? req.submittedBy.userName.toLowerCase() : '';
                const assigneeName = (req.assignee?.name && typeof req.assignee.name === 'string') ? req.assignee.name.toLowerCase() : '';
                const ownerEmail = (req.ownerEmail && typeof req.ownerEmail === 'string') ? req.ownerEmail.toLowerCase() : '';
                
                return requestId.includes(lowercasedTerm) ||
                       type.includes(lowercasedTerm) ||
                       userName.includes(lowercasedTerm) ||
                       assigneeName.includes(lowercasedTerm) ||
                       ownerEmail.includes(lowercasedTerm);
            });
        }
        
        if (ownerFilter.length > 0) {
            const normalizedOwnerFilter = new Set(ownerFilter.map(email => normalizeEmail(email)).filter(Boolean));
            items = items.filter(req => {
                const normalizedOwnerEmail = normalizeEmail(req.ownerEmail);
                return normalizedOwnerEmail && normalizedOwnerFilter.has(normalizedOwnerEmail);
            });
        }

        if (sortKey) {
            items.sort((a, b) => {
                let valA: unknown;
                let valB: unknown;

                switch (sortKey) {
                    case 'submittedBy':
                        valA = a.submittedBy.userName;
                        valB = b.submittedBy.userName;
                        break;
                    case 'assignee':
                        valA = a.assignee?.name || '';
                        valB = b.assignee?.name || '';
                        break;
                    case 'ownerEmail':
                        valA = findCollaboratorByEmail(collaborators, a.ownerEmail)?.name || a.ownerEmail;
                        valB = findCollaboratorByEmail(collaborators, b.ownerEmail)?.name || b.ownerEmail;
                        break;
                    case 'submittedAt':
                        valA = new Date(a.submittedAt).getTime();
                        valB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                        break;
                    case 'requestId':
                        valA = parseInt(a.requestId, 10);
                        valB = parseInt(b.requestId, 10);
                        break;
                    case 'isArchived':
                        valA = a.isArchived ?? false;
                        valB = b.isArchived ?? false;
                        break;
                    default:
                        valA = a[sortKey as keyof WorkflowRequest];
                        valB = b[sortKey as keyof WorkflowRequest];
                }

                const comparableA =
                    typeof valA === 'number' ? valA :
                    typeof valA === 'boolean' ? Number(valA) :
                    String(valA ?? '');
                const comparableB =
                    typeof valB === 'number' ? valB :
                    typeof valB === 'boolean' ? Number(valB) :
                    String(valB ?? '');

                let comparison = 0;
                if (comparableA > comparableB) {
                    comparison = 1;
                } else if (comparableA < comparableB) {
                    comparison = -1;
                }

                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return items;
    }, [requests, searchTerm, sortKey, sortDirection, showArchived, ownerFilter, attentionFilter, collaborators]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    const handleOwnerFilterChange = (email: string) => {
        setOwnerFilter(prev => 
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const getStatusInfo = (request: WorkflowRequest) => {
        const definition = workflowDefinitions.find(d => d.name === request.type);
        const status = definition?.statuses.find(s => s.id === request.status);
        const label = status?.label || request.status;

        if (!definition || !definition.statuses || definition.statuses.length === 0) {
            return { label, color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-800' };
        }
        
        const initialStatusId = definition.statuses[0].id;
        const finalStatusLabels = ['aprovado', 'reprovado', 'concluído', 'finalizado', 'cancelado'];

        if (request.status === initialStatusId && request.history.length <= 1) {
            return { label, color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800' }; // Aberto - Vermelho
        } else if (status && status.label && typeof status.label === 'string' && finalStatusLabels.some(l => status.label.toLowerCase().includes(l))) {
            return { label, color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800' }; // Finalizado - Verde
        } else {
            return { label, color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-800' }; // Intermediário - Laranja
        }
    };
    
    const getOwner = (email: string) => {
        return findCollaboratorByEmail(collaborators, email);
    }
    const getOwnerName = (email: string) => {
        return getOwner(email)?.name || email;
    }
    const getCollaborator = (userId: string) => {
        return collaborators.find(c => getCollaboratorUserId(c) === userId);
    }

    const handleArchiveRequest = async (id: string) => {
        try {
            await archiveRequestMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "A solicitação foi arquivada." });
        } catch {
            toast({ title: "Erro ao Arquivar", description: "Não foi possível arquivar a solicitação.", variant: "destructive" });
        }
    };

    const handleExportCSV = () => {
        const dataToExport = filteredAndSortedRequests.map(req => {
             const flatFormData = Object.entries(req.formData).map(([key, value]) => {
                if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
                    return { [key]: `${value.from} a ${value.to}` };
                }
                return { [key]: value };
            }).reduce((acc, current) => ({ ...acc, ...current }), {});

            return {
                ID_Solicitacao: req.requestId,
                Tipo: req.type,
                Status: getStatusInfo(req).label,
                Responsavel: req.assignee?.name || 'Não atribuído',
                Proprietario_Workflow: getOwnerName(req.ownerEmail),
                Solicitante: req.submittedBy.userName,
                Email_Solicitante: req.submittedBy.userEmail,
                Data_Submissao: format(parseISO(req.submittedAt), "dd/MM/yyyy HH:mm:ss"),
                Arquivada: req.isArchived ? 'Sim' : 'Não',
                ...flatFormData
            };
        });

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_geral_solicitacoes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderSkeleton = () => (
        <div className="space-y-2">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
    );
    
    const SortableHeader = ({ tkey, label, className }: { tkey: SortKey; label: string; className?: string }) => (
      <TableHead onClick={() => handleSort(tkey)} className={cn("cursor-pointer hover:bg-muted/50", className)}>
          <div className="flex items-center gap-1">
              {label}
              {sortKey === tkey && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
          </div>
      </TableHead>
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                               <ListChecks className="h-6 w-6" />
                               Histórico Geral de Solicitações
                            </CardTitle>
                            <CardDescription>
                                {filteredAndSortedRequests.length} solicitação(ões) encontrada(s) em todo o sistema.
                            </CardDescription>
                        </div>
                        <div className="flex w-full sm:w-auto flex-wrap gap-2">
                            <div className="relative flex-grow">
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                 <Input 
                                    placeholder="Buscar em todas as solicitações..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 w-full"
                                />
                            </div>
                             <Button 
                                variant="outline"
                                onClick={() => setAttentionFilter(!attentionFilter)}
                                className={cn(
                                    "transition-colors",
                                    attentionFilter && "bg-destructive/10 text-destructive border-destructive"
                                )}
                             >
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Atenção
                            </Button>
                            <Button 
                                variant="outline"
                                onClick={() => setShowArchived(!showArchived)}
                                className={cn(
                                    "transition-colors",
                                    showArchived && "bg-muted text-foreground"
                                )}
                            >
                                <Archive className="mr-2 h-4 w-4"/>
                                {showArchived ? "Ocultar Arquivadas" : "Mostrar Arquivadas"}
                            </Button>
                            <Button onClick={handleExportCSV} disabled={filteredAndSortedRequests.length === 0} className="bg-admin-primary hover:bg-admin-primary/90">
                                <FileDown className="mr-2 h-4 w-4" />
                                Exportar CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? renderSkeleton() : (
                         <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHeader tkey="requestId" label="#" />
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Solicitante</TableHead>
                                        <TableHead>Responsável</TableHead>
                                        <TableHead>
                                            <div className="flex items-center gap-2">
                                                <span className="flex-grow">Proprietário</span>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted">
                                                            <Filter className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuLabel>Filtrar por Proprietário</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <ScrollArea className="max-h-60">
                                                            {uniqueOwners.map(owner => (
                                                                <DropdownMenuCheckboxItem
                                                                    key={owner.id}
                                                                    checked={ownerFilter.includes(owner.email)}
                                                                    onCheckedChange={() => handleOwnerFilterChange(owner.email)}
                                                                >
                                                                    {owner.name}
                                                                </DropdownMenuCheckboxItem>
                                                            ))}
                                                        </ScrollArea>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableHead>
                                        <SortableHeader tkey="submittedAt" label="Data" />
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndSortedRequests.map((req) => {
                                        const isUnassignedForTooLong = !req.assignee && differenceInHours(new Date(), parseISO(req.submittedAt)) > 24;
                                        const hasOverdueActionRequest = (req.actionRequests?.[req.status] || []).some(ar =>
                                            ar.status === 'pending' && differenceInHours(new Date(), parseISO(ar.requestedAt)) > 24
                                        );
                                        const needsAttention = !req.isArchived && (isUnassignedForTooLong || hasOverdueActionRequest);
                                        const statusInfo = getStatusInfo(req);
                                        const requester = getCollaborator(req.submittedBy.userId);
                                        const owner = getOwner(req.ownerEmail);
                                        const assigneeCollab = req.assignee ? getCollaborator(req.assignee.id) : null;

                                        return (
                                        <TableRow key={req.id} className={cn(
                                            req.isArchived && "bg-muted/30 text-muted-foreground",
                                            needsAttention && "bg-amber-400/10"
                                        )}>
                                            <TableCell className="font-mono text-xs">{req.requestId}</TableCell>
                                            <TableCell className="font-medium">{req.type}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("font-semibold", statusInfo.color)}>
                                                    {statusInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        {requester?.photoURL && <AvatarImage src={requester.photoURL} alt={requester.name} />}
                                                        <AvatarFallback className="text-xs">
                                                            {requester?.name?.charAt(0) || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm">{req.submittedBy.userName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {req.assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            {assigneeCollab?.photoURL && <AvatarImage src={assigneeCollab.photoURL} alt={req.assignee.name} />}
                                                            <AvatarFallback className="text-xs">
                                                                {req.assignee.name?.charAt(0) || '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm">{req.assignee.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm font-semibold text-destructive">Não atribuído</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                 <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        {owner?.photoURL && <AvatarImage src={owner.photoURL} alt={owner.name}/>}
                                                        <AvatarFallback className="text-xs">
                                                            {owner?.name?.charAt(0) || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm">{getOwnerName(req.ownerEmail)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{format(parseISO(req.submittedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                                            <TableCell className="text-right">
                                                 <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" disabled={req.isArchived} className="hover:bg-muted">
                                                            <Archive className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>Arquivar Solicitação?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta ação irá remover a solicitação das caixas de entrada, mas ela continuará existindo no sistema para fins de auditoria. Tem certeza que deseja arquivar a solicitação #{req.requestId}?
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleArchiveRequest(req.id)}>Sim, Arquivar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <Button variant="ghost" size="icon" onClick={() => setViewingRequest(req)} className="hover:bg-muted">
                                                    <Eye className="h-5 w-5 text-muted-foreground"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                         </div>
                    )}
                    {!loading && filteredAndSortedRequests.length === 0 && (
                        <div className="text-center py-10 px-6 border-2 border-dashed rounded-lg">
                            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-medium text-foreground">Nenhuma solicitação encontrada</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Não há solicitações que correspondam à sua busca.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <RequestApprovalModal
                isOpen={!!viewingRequest}
                onClose={() => setViewingRequest(null)}
                request={viewingRequest}
            />
        </>
    );
}

    
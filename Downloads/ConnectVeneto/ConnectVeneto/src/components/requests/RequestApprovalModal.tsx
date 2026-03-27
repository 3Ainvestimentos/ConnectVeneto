

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { format, formatISO, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useWorkflows, WorkflowRequest, WorkflowHistoryLog } from '@/contexts/WorkflowsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators, Collaborator, getCollaboratorUserId } from '@/contexts/CollaboratorsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, User, Calendar, Type, Clock, FileText, History, MoveRight, Users, Send, ExternalLink, ShieldQuestion, CheckCircle, Hourglass, XCircle, ThumbsUp, ThumbsDown, Circle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { useApplications, WorkflowStatusDefinition } from '@/contexts/ApplicationsContext';
import { AssigneeSelectionModal } from './AssigneeSelectionModal';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { uploadFile } from '@/lib/firestore-service';
import { useWorkflowAreas } from '@/contexts/WorkflowAreasContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RecipientSelectionModal } from '../admin/RecipientSelectionModal';
import { findCollaboratorByEmail } from '@/lib/email-utils';

interface RequestApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: WorkflowRequest | null;
}

const actionStatusTranslations: { [key: string]: string } = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  acknowledged: 'Ciente',
  executed: 'Executado',
};

const actionStatusPastTense: { [key: string]: string } = {
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  acknowledged: 'Registrada como ciente',
  executed: 'Executada',
};

const getTranslatedStatus = (status: string) => actionStatusTranslations[status] || status;

type DateRangeValue = { from?: string; to?: string };
const isDateRangeValue = (value: unknown): value is DateRangeValue => {
  if (!value || typeof value !== 'object') return false;
  const maybeRange = value as { from?: unknown; to?: unknown };
  const fromOk = maybeRange.from === undefined || typeof maybeRange.from === 'string';
  const toOk = maybeRange.to === undefined || typeof maybeRange.to === 'string';
  return fromOk && toOk;
};


export function RequestApprovalModal({ isOpen, onClose, request }: RequestApprovalModalProps) {
  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { updateRequestAndNotify } = useWorkflows();
  const { workflowDefinitions } = useApplications();
  const { workflowAreas } = useWorkflowAreas();

  const [comment, setComment] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [assignee, setAssignee] = useState<Collaborator | null>(null);
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
  const [isActionRecipientModalOpen, setIsActionRecipientModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionType, setActionType] = useState<'statusChange' | 'assign' | 'comment' | 'requestAction' | 'actionResponse' | null>(null);
  const [actionResponse, setActionResponse] = useState<'approved' | 'rejected' | 'acknowledged' | 'executed' | null>(null);


  const definition = useMemo(() => {
    if (!request) return null;
    return workflowDefinitions.find(def => def.name === request.type);
  }, [request, workflowDefinitions]);
  
  const workflowArea = useMemo(() => {
    if (!definition) return null;
    return workflowAreas.find(area => area.id === definition.areaId);
  }, [definition, workflowAreas]);

  const adminUser = useMemo(() => {
    if (!user) return null;
    return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);
  
  const actionRequestsForCurrentStatus = useMemo(() => {
    if (!request?.actionRequests || !request.status) return [];
    return request.actionRequests[request.status] || [];
  }, [request]);

  const currentUserActionRequest = useMemo(() => {
    if (!adminUser) return null;
    return actionRequestsForCurrentStatus.find(ar => ar.userId === getCollaboratorUserId(adminUser)) || null;
  }, [actionRequestsForCurrentStatus, adminUser]);


  const currentStatusDefinition = useMemo(() => {
    if (!definition || !request) return null;
    return definition.statuses.find(s => s.id === request.status);
  }, [definition, request]);

  const nextStatus = useMemo((): WorkflowStatusDefinition | null => {
    if (!definition || !request?.status) return null;
    const currentIndex = definition.statuses.findIndex(s => s.id === request.status);
    if (currentIndex === -1 || currentIndex >= definition.statuses.length - 1) {
      return null;
    }
    return definition.statuses[currentIndex + 1];
  }, [definition, request]);


  useEffect(() => {
    if (request) {
      setComment('');
      setAttachment(null);
      if (request.assignee) {
        const currentAssignee = collaborators.find(c => getCollaboratorUserId(c) === request.assignee?.id);
        setAssignee(currentAssignee || null);
      } else {
        setAssignee(null);
      }
    }
  }, [request, collaborators, isOpen]);

  if (!request || !definition) {
    // This handles the edge case where the definition might not be loaded yet or the request is invalid.
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="sr-only">Carregando</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </DialogContent>
        </Dialog>
    );
  }
  
  const handleRequestAction = async (recipientIds: string[]) => {
    setActionType('requestAction');
    if (!adminUser || !currentStatusDefinition?.action) {
      toast({ title: "Erro", description: "Não foi possível identificar o solicitante ou a ação.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    const now = new Date();

    const existingUserIds = new Set(actionRequestsForCurrentStatus.map(ar => ar.userId));
    const newRecipients = recipientIds
      .map(id => collaborators.find(c => getCollaboratorUserId(c) === id))
      .filter((c): c is Collaborator => !!c && !existingUserIds.has(getCollaboratorUserId(c) || ''));

    if (newRecipients.length === 0) {
      toast({ title: "Nenhuma ação necessária", description: "Todos os usuários selecionados já têm uma solicitação de ação pendente ou foram removidos.", variant: "default" });
      setIsSubmitting(false);
      setActionType(null);
      return;
    }

    const newActionRequests = newRecipients.map(recipient => ({
      userId: getCollaboratorUserId(recipient) || '',
      userName: recipient.name,
      status: 'pending' as const,
      requestedAt: formatISO(now),
    }));
    
    const historyNote = `Ação de "${currentStatusDefinition.action.label}" solicitada para ${newRecipients.map(r => r.name).join(', ')}.`;
    const historyEntry: WorkflowHistoryLog = {
      timestamp: formatISO(now),
      status: request.status,
      userId: getCollaboratorUserId(adminUser) || '',
      userName: adminUser.name,
      notes: historyNote,
    };
    
    const requestUpdate = {
        id: request.id,
        lastUpdatedAt: formatISO(now),
        actionRequests: {
            ...request.actionRequests,
            [request.status]: [...actionRequestsForCurrentStatus, ...newActionRequests],
        },
        history: [...request.history, historyEntry],
    };

    try {
        await updateRequestAndNotify(requestUpdate, undefined, `Você tem uma nova ação pendente para a solicitação #${request.requestId}.`);
        toast({ title: "Sucesso!", description: "Solicitação de ação enviada.", variant: 'success' });
    } catch {
        toast({ title: "Erro", description: "Não foi possível solicitar a ação.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
        setActionType(null);
    }
  };

  const handleActionResponse = async (response: 'approved' | 'rejected' | 'acknowledged' | 'executed') => {
    setActionType('actionResponse');
    setActionResponse(response);
    if (!user || !adminUser || !currentUserActionRequest) return;
    
    const actionDef = currentStatusDefinition?.action;
    
    if (response === 'executed' && actionDef?.type === 'execution') {
        if (actionDef.commentRequired && !comment.trim()) {
            toast({ title: "Erro de Validação", description: "O comentário é obrigatório para esta ação.", variant: "destructive" });
            setActionResponse(null);
            return;
        }
    }
    
    setIsSubmitting(true);
    
    const now = new Date();
    const actionLabel = actionStatusPastTense[response] || 'Processada';
    let historyNote = `Ação foi ${actionLabel}.`;
    let attachmentUrl = '';

    try {
        const storagePath = workflowArea?.storageFolderPath;
        if (!storagePath) {
            throw new Error(`A área de workflow para "${definition?.name}" não tem uma pasta de armazenamento configurada.`);
        }
        if (response === 'executed' && attachment) {
            attachmentUrl = await uploadFile(attachment, storagePath, request.id, attachment.name);
            historyNote += ` Anexo: ${attachment.name}.`;
        }
    } catch {
        toast({ title: "Erro de Upload", description: "Não foi possível enviar o anexo. A ação foi cancelada.", variant: "destructive"});
        setIsSubmitting(false);
        setActionType(null);
        setActionResponse(null);
        return;
    }
    
    if (comment.trim()) {
        historyNote += ` Comentário: ${comment}`;
    }
    
    const updatedActionRequests = actionRequestsForCurrentStatus.map(ar => 
        ar.userId === getCollaboratorUserId(adminUser) ? { 
          ...ar, 
          status: response, 
          respondedAt: formatISO(now),
          comment: comment || '',
          attachmentUrl: attachmentUrl || '',
        } : ar
    );

    const requestUpdate = {
        id: request.id,
        lastUpdatedAt: formatISO(now),
        actionRequests: {
            ...request.actionRequests,
            [request.status]: updatedActionRequests,
        },
        history: [...request.history, { timestamp: formatISO(now), status: request.status, userId: getCollaboratorUserId(adminUser) || '', userName: adminUser.name, notes: historyNote }],
    };

    const notificationMessage = `A ação na tarefa '${request.type}' #${request.requestId} foi ${actionLabel.toLowerCase()} por ${adminUser.name}.`;

    try {
        await updateRequestAndNotify(requestUpdate, undefined, notificationMessage);
        toast({ title: "Sucesso!", description: `Ação registrada como "${getTranslatedStatus(response)}".`, variant: 'success' });
        setComment('');
        setAttachment(null);
    } catch {
        toast({ title: "Erro", description: "Não foi possível registrar sua ação.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
        setActionType(null);
        setActionResponse(null);
    }
  };
  
const handleStatusChange = async () => {
    if (!nextStatus || !adminUser) return;

    setActionType('statusChange');
    setIsSubmitting(true);
    
    const now = new Date();
    
    const historyEntry: WorkflowHistoryLog = {
      timestamp: formatISO(now),
      status: nextStatus.id,
      userId: getCollaboratorUserId(adminUser) || '',
      userName: adminUser.name,
      notes: comment || `Status alterado para "${nextStatus.label}".`,
    };
    
    const requestUpdate = {
      id: request.id,
      status: nextStatus.id,
      lastUpdatedAt: formatISO(now),
      history: [...request.history, historyEntry],
    };

    const notificationMessage = `O status da sua solicitação de '${request.type}' #${request.requestId} foi atualizado para "${nextStatus.label}".\nObservações: ${comment || 'Nenhuma.'}`;

    try {
      await updateRequestAndNotify(requestUpdate, notificationMessage);
      toast({
        title: "Sucesso!",
        description: `A solicitação foi atualizada para "${nextStatus.label}". O usuário será notificado.`,
        variant: 'success'
      });
      setComment('');
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível processar a ação.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
};


  const handleAssigneeChange = async () => {
    setActionType('assign');
    if (!user || !adminUser || !assignee) {
      toast({ title: "Erro", description: "Usuário administrador ou colaborador selecionado não encontrado.", variant: "destructive" });
      return;
    }
    
    if (getCollaboratorUserId(assignee) === request.assignee?.id) {
        toast({ title: "Atenção", description: "Este colaborador já é o responsável." });
        setActionType(null);
        return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const historyNote = `Solicitação atribuída a ${assignee.name}.` + (comment ? ` Comentário: ${comment}` : '');

    const historyEntry: WorkflowHistoryLog = {
      timestamp: formatISO(now),
      status: request.status,
      userId: getCollaboratorUserId(adminUser) || '',
      userName: adminUser.name,
      notes: historyNote,
    };

    const requestUpdate = {
      id: request.id,
      assignee: { id: getCollaboratorUserId(assignee) || '', name: assignee.name },
      lastUpdatedAt: formatISO(now),
      history: [...request.history, historyEntry],
    };

    const requesterNotification = `Sua solicitação de '${request.type}' #${request.requestId} foi atribuída a ${assignee.name} para acompanhamento.`;
    const assigneeNotification = `A solicitação #${request.requestId} de '${request.type}', enviada por ${request.submittedBy.userName}, foi atribuída a você.`;

    try {
      await updateRequestAndNotify(requestUpdate, requesterNotification, assigneeNotification);
      toast({ title: "Sucesso!", description: `Solicitação atribuída a ${assignee.name}.`, variant: 'success' });
      setComment('');
    } catch {
       toast({ title: "Erro", description: "Não foi possível atribuir o responsável.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  const handleAddComment = async () => {
    setActionType('comment');
    if (!comment.trim()) {
        toast({ title: "Atenção", description: "O campo de comentário não pode estar vazio.", variant: "destructive" });
        return;
    }

    if (!user || !adminUser) {
        toast({ title: "Erro de Autenticação", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const historyEntry: WorkflowHistoryLog = {
        timestamp: formatISO(now),
        status: request.status,
        userId: getCollaboratorUserId(adminUser) || '',
        userName: adminUser.name,
        notes: comment,
    };
    
    const requestUpdate = {
        id: request.id,
        lastUpdatedAt: formatISO(now),
        history: [...request.history, historyEntry],
    };

    const notificationMessage = `Um novo comentário foi adicionado à sua solicitação '${request.type}' #${request.requestId} por ${adminUser.name}.\nComentário: ${comment}`;
    
    try {
        await updateRequestAndNotify(requestUpdate, notificationMessage);
        toast({ title: "Sucesso!", description: "Comentário adicionado ao histórico.", variant: 'success' });
        setComment('');
    } catch {
        toast({ title: "Erro", description: "Não foi possível adicionar o comentário.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
        setActionType(null);
    }
  };

  const renderFieldValue = (fieldId: string, value: unknown) => {
    const fieldDef = definition?.fields.find(f => f.id === fieldId);
    if (!fieldDef) return <p><strong>{fieldId}:</strong> {JSON.stringify(value)}</p>;
    
    let displayValue: React.ReactNode = typeof value === 'string' ? value : JSON.stringify(value);

    if (fieldDef.type === 'file' && typeof value === 'string' && value) {
      const fileName = value.split('%2F').pop()?.split('?')[0] || 'Arquivo';
      return (
        <div className="flex items-center gap-2">
            <p className="text-muted-foreground"><strong className="font-medium text-foreground">{fieldDef.label}:</strong></p>
            <Button asChild variant="link" className="p-0 h-auto">
                <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    {decodeURIComponent(fileName)}
                    <ExternalLink className="h-3 w-3" />
                </a>
            </Button>
        </div>
      );
    }
    else if (fieldDef.type === 'date' && value) {
      const date = typeof value === 'string' ? parseISO(value) : null;
      displayValue = date && isValid(date) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inválida';
    } else if (fieldDef.type === 'date-range' && value) {
      const from = isDateRangeValue(value) && value.from ? parseISO(value.from) : null;
      const to = isDateRangeValue(value) && value.to ? parseISO(value.to) : null;
      displayValue = (from && isValid(from) && to && isValid(to)) 
        ? `${format(from, 'dd/MM/yyyy')} a ${format(to, 'dd/MM/yyyy')}`
        : 'Período inválido';
    }

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap">
        <strong>{fieldDef.label}:</strong>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayValue?.toString() || ''}</ReactMarkdown>
      </div>
    );
  }

  const renderFormData = () => {
    if (!definition?.fields) return <p className="text-muted-foreground">Sem definição de formulário encontrada.</p>;
    if (!request.formData || Object.keys(request.formData).length === 0) return <p className="text-muted-foreground">O solicitante não preencheu dados no formulário.</p>;
    
    const renderedKeys = new Set<string>();

    return (
        <div className="space-y-2">
            {definition.fields.map((field, index) => {
                const value = request.formData[field.id];
                // CORREÇÃO: Detectar objetos vazios que podem ter sido salvos incorretamente
                if (value === undefined || value === null || 
                    (typeof value === 'string' && value.trim() === '') ||
                    (typeof value === 'object' && Object.keys(value).length === 0)) {
                    return null; // Não exibe campos vazios ou inválidos
                }
                renderedKeys.add(field.id);
                return (
                    <div key={`${field.id}-${index}`}>
                        {renderFieldValue(field.id, value)}
                    </div>
                );
            })}
            {Object.entries(request.formData).map(([key, value]) => {
              if (!renderedKeys.has(key)) {
                return (
                  <div key={key}>
                    {renderFieldValue(key, value)}
                  </div>
                )
              }
              return null;
            })}
        </div>
    );
  };
  
  const getActionRequestIcon = (status: string) => {
    switch (status) {
        case 'pending': return <Hourglass className="h-4 w-4 text-yellow-500" />;
        case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'acknowledged': return <CheckCircle className="h-4 w-4 text-blue-500" />;
        case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
        case 'executed': return <CheckCircle className="h-4 w-4 text-purple-500" />;
        default: return <ShieldQuestion className="h-4 w-4 text-muted-foreground" />;
    }
  }

  const renderCurrentUserAction = () => {
      if (!currentUserActionRequest) return null;
      
      const actionDef = currentStatusDefinition?.action;
      const isPending = currentUserActionRequest.status === 'pending';

      if (!isPending) {
        const statusConfig = {
          pending: { icon: Hourglass, color: 'bg-yellow-500', text: 'Pendente' },
          approved: { icon: ThumbsUp, color: 'bg-success', text: 'Aprovado' },
          rejected: { icon: ThumbsDown, color: 'bg-destructive', text: 'Rejeitado' },
          acknowledged: { icon: CheckCircle, color: 'bg-blue-600', text: 'Ciente' },
          executed: { icon: CheckCircle, color: 'bg-purple-600', text: 'Executado' },
        }[currentUserActionRequest.status] || { icon: CheckCircle, color: 'bg-muted', text: 'Concluído' };

        const Icon = statusConfig.icon;
        
        return (
          <Button disabled className={cn("w-full", statusConfig.color)}>
            <Icon className="mr-2 h-4 w-4" /> {statusConfig.text}
          </Button>
        )
      }
      
      return (
         <div className="mt-4 pt-4 border-t">
          {actionDef?.type === 'approval' && (
            <div className="flex flex-wrap gap-2">
                <Button variant="destructive" size="sm" onClick={() => handleActionResponse('rejected')} disabled={isSubmitting}>
                  {isSubmitting && actionResponse === 'rejected' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                    Reprovar
                </Button>
                <Button className="bg-success hover:bg-success/90 text-success-foreground" size="sm" onClick={() => handleActionResponse('approved')} disabled={isSubmitting}>
                    {isSubmitting && actionResponse === 'approved' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                    Aprovar
                </Button>
            </div>
          )}
          {actionDef?.type === 'execution' && (
            <div className="w-full space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="execution_comment">Comentário {actionDef?.commentRequired && '*'}</Label>
                    <Textarea id="execution_comment" value={comment} onChange={e => setComment(e.target.value)} placeholder={actionDef?.commentPlaceholder || ''} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="execution_attachment">Anexo</Label>
                    <Input id="execution_attachment" type="file" onChange={e => setAttachment(e.target.files ? e.target.files[0] : null)} placeholder={actionDef?.attachmentPlaceholder || ''}/>
                </div>
                <Button className="w-full bg-admin-primary hover:bg-admin-primary/90" onClick={() => handleActionResponse('executed')} disabled={isSubmitting}>
                    {isSubmitting && actionResponse === 'executed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Confirmar Execução
                </Button>
            </div>
          )}
          {actionDef?.type === 'acknowledgement' && (
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm" onClick={() => handleActionResponse('acknowledged')} disabled={isSubmitting}>
                {isSubmitting && actionResponse === 'acknowledged' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Marcar como Ciente
            </Button>
          )}
        </div>
      );
  }

    const findActionResponseForHistoryLog = (log: WorkflowHistoryLog) => {
        if (!request.actionRequests) return null;
        for (const statusId in request.actionRequests) {
            const actionReqs = request.actionRequests[statusId];
            const matchingAction = actionReqs.find(ar => 
                ar.userId === log.userId && 
                ar.respondedAt && 
                Math.abs(parseISO(ar.respondedAt).getTime() - parseISO(log.timestamp).getTime()) < 2000
            );
            if (matchingAction) {
                return matchingAction;
            }
        }
        return null;
    };

    const getStatusIndex = (statusId: string) => definition.statuses.findIndex(s => s.id === statusId);

    const isFinalStatus = (statusId: string) => {
        const finalLabels = ['aprovado', 'reprovado', 'concluído', 'finalizado', 'cancelado'];
        const statusDef = definition.statuses.find(s => s.id === statusId);
        if (!statusDef) return false;
        
        const statusIdLower = (statusDef.id && typeof statusDef.id === 'string') ? statusDef.id.toLowerCase() : '';
        const statusLabel = (statusDef.label && typeof statusDef.label === 'string') ? statusDef.label.toLowerCase() : '';
        
        return finalLabels.includes(statusIdLower) || 
               finalLabels.some(label => statusLabel.includes(label));
    }


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl flex items-center gap-2">
              <FileText className="h-6 w-6" /> Detalhes da Solicitação
            </DialogTitle>
            <DialogDescription>
              {`Revise a solicitação #${request.requestId} e tome uma ação.`}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-3">
                      <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div><span className="font-semibold">Solicitante:</span> {request.submittedBy.userName}</div>
                  </div>
                   <div className="flex items-start gap-3">
                      <Type className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div><span className="font-semibold">Tipo:</span> {request.type}</div>
                  </div>
                  <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div><span className="font-semibold">Data:</span> {format(parseISO(request.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                  </div>
                   <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div><span className="font-semibold">Última Atualização:</span> {format(parseISO(request.lastUpdatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                  </div>
              </div>

              <Separator />
              
              <div>
                  <h3 className="font-semibold text-lg mb-2">Dados da Solicitação</h3>
                  <div className="p-4 bg-muted/50 rounded-md text-sm break-words whitespace-pre-wrap">
                      {renderFormData()}
                  </div>
              </div>
              
              <Separator />

                <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><History className="h-5 w-5"/>Linha do Tempo e Histórico</h3>
                    <div className="space-y-4">
                        {definition.statuses.map((status, index) => {
                            const currentStatusIndex = getStatusIndex(request.status);
                            const isFinal = isFinalStatus(status.id);
                            
                            let state: 'completed' | 'current' | 'pending' = 'pending';
                            if (index < currentStatusIndex || (isFinal && index === currentStatusIndex)) {
                                state = 'completed';
                            } else if (index === currentStatusIndex && !isFinal) {
                                state = 'current';
                            }

                             const relevantLogs = request.history.filter(log => getStatusIndex(log.status) === index);

                            return (
                                <div key={`${status.id}-${index}`} className="flex items-start gap-3">
                                    <div className="flex flex-col items-center">
                                        {state === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                        {state === 'current' && <Hourglass className="h-5 w-5 text-yellow-500 animate-pulse" />}
                                        {state === 'pending' && <Circle className="h-5 w-5 text-muted-foreground/30" />}
                                        {index < definition.statuses.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
                                    </div>
                                    <div className={cn("pt-0 flex-grow", state === 'pending' && 'text-muted-foreground')}>
                                        <p className="font-semibold text-sm">{status.label}</p>
                                         {relevantLogs.length > 0 && (state === 'completed' || state === 'current') && (
                                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                {relevantLogs.map((log, logIndex) => {
                                                    const actionResponse = findActionResponseForHistoryLog(log);
                                                    return (
                                                        <div key={logIndex} className="italic">
                                                            <p>
                                                                &#8226; {log.userName} em {format(parseISO(log.timestamp), 'dd/MM/yy HH:mm')}
                                                                {actionResponse && <span className="font-bold"> ({getTranslatedStatus(actionResponse.status)})</span>}
                                                            </p>
                                                            {log.notes && <blockquote className="border-l-2 pl-2 ml-2 text-foreground/80">&quot;{log.notes}&quot;</blockquote>}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
              
              <Separator />

              <div>
                  <h3 className="font-semibold text-lg mb-2">Atribuir Responsável</h3>
                   <div className="flex items-center gap-2">
                      <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          onClick={() => setIsAssigneeModalOpen(true)}
                          disabled={isSubmitting}
                      >
                          {assignee ? (
                              <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                      {assignee.photoURL ? <AvatarImage src={assignee.photoURL} alt={assignee.name} /> : null}
                                      <AvatarFallback className="text-xs">
                                          {(assignee.name && typeof assignee.name === 'string' && assignee.name.length > 0) ? assignee.name.charAt(0) : '?'}
                                      </AvatarFallback>
                                  </Avatar>
                                  <span>{assignee.name}</span>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                  <Users className="h-4 w-4" />
                                  <span>Selecionar um responsável...</span>
                              </div>
                          )}
                      </Button>
                       <Button 
                          onClick={() => handleAssigneeChange()} 
                          disabled={isSubmitting || !assignee || getCollaboratorUserId(assignee) === request.assignee?.id}
                          className="bg-admin-primary hover:bg-admin-primary/90"
                      >
                          {isSubmitting && actionType === 'assign' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Atribuir
                      </Button>
                  </div>
              </div>
              
              {actionRequestsForCurrentStatus.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Histórico de Ações Solicitadas</h3>
                  <div className="p-4 bg-muted/50 rounded-md text-sm space-y-2">
                      {actionRequestsForCurrentStatus.map((ar) => {
                        const isCurrentUserAction = ar.userId === getCollaboratorUserId(adminUser);
                        return (
                          <div key={ar.userId} className={cn("p-2 border rounded-md")}>
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                      {getActionRequestIcon(ar.status)}
                                      <span>{ar.userName}</span>
                                  </div>
                                  <Badge variant="secondary" className="capitalize">{getTranslatedStatus(ar.status)}</Badge>
                              </div>

                              {isCurrentUserAction && renderCurrentUserAction()}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              <div>
                  <Label htmlFor="comment">Adicionar Comentário</Label>
                  <div className="flex items-center gap-2 mt-1">
                      <Textarea
                          id="comment"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Deixe uma observação para o solicitante e para o histórico..."
                          disabled={isSubmitting}
                      />
                      <Button 
                          variant="secondary" 
                          onClick={handleAddComment}
                          disabled={isSubmitting || !comment.trim()}
                          className="h-full"
                      >
                          {isSubmitting && actionType === 'comment' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="h-4 w-4"/>}
                          <span className="sr-only">Salvar comentário</span>
                      </Button>
                  </div>
              </div>
          </div>
          </ScrollArea>

          <DialogFooter className="pt-4 flex flex-col sm:flex-row sm:justify-between gap-2">
            <div className="flex-grow flex items-center gap-2">
                {nextStatus && (
                     <Button 
                        key={nextStatus.id}
                        className="bg-admin-primary hover:bg-admin-primary/90"
                        onClick={handleStatusChange} 
                        disabled={isSubmitting}
                    >
                        {(isSubmitting && actionType === 'statusChange') ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <MoveRight className="mr-2 h-4 w-4" />
                        )}
                        Mover para &quot;{nextStatus.label}&quot;
                    </Button>
                )}
                {currentStatusDefinition?.action && (
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsActionRecipientModalOpen(true)}
                        disabled={isSubmitting}
                    >
                        <Send className="mr-2 h-4 w-4"/>
                        Solicitar Ação
                    </Button>
                )}
            </div>
            <div className="flex gap-2 self-end">
                <DialogClose asChild><Button variant="outline" className="hover:bg-muted">Fechar</Button></DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AssigneeSelectionModal
          isOpen={isAssigneeModalOpen}
          onClose={() => setIsAssigneeModalOpen(false)}
          allCollaborators={collaborators}
          currentAssigneeId={assignee ? getCollaboratorUserId(assignee) || undefined : undefined}
          onConfirm={(selected) => {
              setAssignee(selected);
              setIsAssigneeModalOpen(false);
          }}
      />
       <RecipientSelectionModal
          isOpen={isActionRecipientModalOpen}
          onClose={() => setIsActionRecipientModalOpen(false)}
          allCollaborators={collaborators}
          selectedIds={[]}
          onConfirm={(ids) => {
            handleRequestAction(ids);
            setIsActionRecipientModalOpen(false);
          }}
       />
    </>
  );
}

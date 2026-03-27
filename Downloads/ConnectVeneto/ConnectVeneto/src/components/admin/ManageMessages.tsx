
"use client";
import React, { useState, useMemo } from 'react';
import { useMessages, type MessageType } from '@/contexts/MessagesContext';
import { getCollaboratorUserId, useCollaborators, type Collaborator } from '@/contexts/CollaboratorsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, CheckCircle, XCircle, Loader2, Users, Bot, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { RecipientSelectionModal } from './RecipientSelectionModal';
import { Switch } from '../ui/switch';
import { parseISO, compareDesc } from 'date-fns';

const messageSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
    content: z.string().min(10, "Conteúdo deve ter no mínimo 10 caracteres"),
    sender: z.string().min(1, "Remetente é obrigatório"),
    link: z.string().url("URL inválida").optional().or(z.literal('')),
    mediaUrl: z.string().url("URL inválida").optional().or(z.literal('')),
    recipientIds: z.array(z.string()).min(1, "Selecione ao menos um destinatário."),
});

type MessageFormValues = z.infer<typeof messageSchema>;
type SortKey = 'date' | 'title';
type SortDirection = 'asc' | 'desc';


const ReadStatusDialog = ({ message, recipients, onOpenChange }: { message: MessageType | null; recipients: Collaborator[]; onOpenChange: (open: boolean) => void; }) => {
    if (!message) return null;

    const readCollaborators = recipients.filter(r => {
        const id = getCollaboratorUserId(r);
        return !!id && message.readBy.includes(id);
    });
    const unreadCollaborators = recipients.filter(r => {
        const id = getCollaboratorUserId(r);
        return !!id && !message.readBy.includes(id);
    });

    return (
        <Dialog open={!!message} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Status de Leitura</DialogTitle>
                    <DialogDescription>&quot;{message.title}&quot;</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                    <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Lido ({readCollaborators.length})</h4>
                        <ScrollArea className="h-64">
                            <ul className="space-y-1 text-sm pr-4">
                                {readCollaborators.map(c => <li key={c.id} className="truncate">{c.name}</li>)}
                            </ul>
                        </ScrollArea>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" /> Não Lido ({unreadCollaborators.length})</h4>
                         <ScrollArea className="h-64">
                            <ul className="space-y-1 text-sm pr-4">
                                {unreadCollaborators.map(c => <li key={c.id} className="truncate">{c.name}</li>)}
                            </ul>
                        </ScrollArea>
                    </div>
                </div>
                 <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Fechar</Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export function ManageMessages() {
    const { messages, addMessage, updateMessage, deleteMessageMutation, getMessageRecipients } = useMessages();
    const { collaborators } = useCollaborators();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<MessageType | null>(null);
    const [viewingStatusFor, setViewingStatusFor] = useState<MessageType | null>(null);
    const [showSystemMessages, setShowSystemMessages] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const ROWS_PER_PAGE = 100;

    const form = useForm<MessageFormValues>({
        resolver: zodResolver(messageSchema),
        defaultValues: { recipientIds: ['all'] }
    });

    const watchRecipientIds = form.watch('recipientIds');
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const filteredMessages = useMemo(() => {
        let items = [...messages];

        if (!showSystemMessages) {
            items = items.filter(msg => msg.sender !== 'Sistema de Workflows');
        }

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            items = items.filter(msg => {
                const title = (msg.title && typeof msg.title === 'string') ? msg.title.toLowerCase() : '';
                return title.includes(lowerSearchTerm);
            });
        }

        items.sort((a, b) => {
            if (sortKey === 'date') {
                const comparison = compareDesc(parseISO(a.date), parseISO(b.date));
                return sortDirection === 'asc' ? -comparison : comparison;
            }
            if (sortKey === 'title') {
                const comparison = a.title.localeCompare(b.title);
                return sortDirection === 'asc' ? comparison : -comparison;
            }
            return 0;
        });

        return items;
    }, [messages, showSystemMessages, searchTerm, sortKey, sortDirection]);
    
    const totalPages = Math.ceil(filteredMessages.length / ROWS_PER_PAGE);
    const paginatedMessages = useMemo(() => {
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        const endIndex = startIndex + ROWS_PER_PAGE;
        return filteredMessages.slice(startIndex, endIndex);
    }, [filteredMessages, currentPage]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }
    
    const handleDialogOpen = (message: MessageType | null) => {
        setEditingMessage(message);
        if (message) {
            form.reset({
                ...message,
                link: message.link || '',
                mediaUrl: message.mediaUrl || '',
            });
        } else {
            form.reset({
                id: undefined,
                title: '',
                content: '',
                sender: 'Admin',
                link: '',
                mediaUrl: '',
                recipientIds: ['all'],
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (messageToDelete: MessageType) => {
        if (!window.confirm(`Tem certeza que deseja excluir a mensagem "${messageToDelete.title}"? Esta ação não pode ser desfeita.`)) return;

        try {
            await deleteMessageMutation.mutateAsync(messageToDelete.id);
            toast({
                title: "Exclusão Concluída",
                description: `A mensagem "${messageToDelete.title}" foi removida com sucesso.`,
                variant: 'success'
            });
        } catch (error) {
            toast({
                title: "Falha na Exclusão",
                description: `Não foi possível remover a mensagem. Causa: ${(error as Error).message}`,
                variant: "destructive"
            });
        }
    };
    
    const onSubmit = async (data: MessageFormValues) => {
        const submissionData = { ...data, date: new Date().toISOString() };

        try {
            if (editingMessage) {
                const updatedMessage: MessageType = {
                    ...editingMessage,
                    ...submissionData,
                };
                await updateMessage(updatedMessage);
                toast({ title: "Mensagem atualizada com sucesso." });
            } else {
                await addMessage(submissionData);
                toast({ title: "Mensagem criada com sucesso." });
            }
            setIsFormOpen(false);
        } catch (error) {
            toast({
                title: "Erro ao salvar mensagem",
                description: `Falha: ${(error as Error).message}`,
                variant: "destructive"
            });
        }
    };
    
    const getRecipientDescription = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Nenhum destinatário';
        if (ids.includes('all')) return 'Todos os Colaboradores';
        return `${ids.length} colaborador(es) selecionado(s)`;
    }

    const viewingStatusRecipients = useMemo(() => {
        if (!viewingStatusFor) return [];
        return getMessageRecipients(viewingStatusFor, collaborators);
    }, [viewingStatusFor, getMessageRecipients, collaborators]);

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Gerenciar Mensagens</CardTitle>
                    <CardDescription>Adicione, edite ou remova mensagens do mural.</CardDescription>
                </div>
                 <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative flex-grow w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por título..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="show-system" checked={showSystemMessages} onCheckedChange={setShowSystemMessages} className="data-[state=checked]:bg-admin-primary" />
                            <Label htmlFor="show-system" className="text-sm text-muted-foreground whitespace-nowrap">Mostrar sistema</Label>
                        </div>
                        <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adicionar
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead onClick={() => handleSort('title')} className="cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center gap-1">
                                        Título
                                        {sortKey === 'title' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                                    </div>
                                </TableHead>
                                <TableHead>Destinatários</TableHead>
                                <TableHead onClick={() => handleSort('date')} className="cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center gap-1">
                                        Data
                                        {sortKey === 'date' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                                    </div>
                                </TableHead>
                                <TableHead>Leituras</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedMessages.map(item => {
                                const recipients = getMessageRecipients(item, collaborators);
                                const totalRecipients = recipients.length;
                                const readCount = item.readBy.length;
                                const isSystemMessage = item.sender === 'Sistema de Workflows';
                                return (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                      {isSystemMessage && <Bot className="h-4 w-4 text-muted-foreground" />}
                                      {item.title}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {getRecipientDescription(item.recipientIds)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="link" 
                                            className="p-0 h-auto" 
                                            disabled={totalRecipients === 0}
                                            onClick={() => setViewingStatusFor(item)}
                                        >
                                            {readCount} / {totalRecipients}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="hover:bg-muted" disabled={deleteMessageMutation.isPending && deleteMessageMutation.variables === item.id}>
                                             {deleteMessageMutation.isPending && deleteMessageMutation.variables === item.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

             <CardFooter className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Exibindo {paginatedMessages.length} de {filteredMessages.length} mensagens.
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Anterior</span>
                    </Button>
                    <span className="text-sm">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                         <span className="sr-only">Próxima</span>
                         <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>

             <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingMessage(null); setIsFormOpen(isOpen); }}>
                <DialogContent className="max-w-2xl">
                <ScrollArea className="max-h-[80vh]">
                  <div className="p-6 pt-0">
                    <DialogHeader>
                        <DialogTitle>{editingMessage ? 'Editar Mensagem' : 'Adicionar Mensagem'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <div>
                            <Label htmlFor="title">Título</Label>
                            <Input id="title" {...form.register('title')} disabled={form.formState.isSubmitting}/>
                            {form.formState.errors.title && <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="content">Conteúdo</Label>
                            <Textarea id="content" {...form.register('content')} rows={5} disabled={form.formState.isSubmitting}/>
                            {form.formState.errors.content && <p className="text-sm text-destructive mt-1">{form.formState.errors.content.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="sender">Remetente</Label>
                            <Input id="sender" {...form.register('sender')} disabled={form.formState.isSubmitting}/>
                            {form.formState.errors.sender && <p className="text-sm text-destructive mt-1">{form.formState.errors.sender.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="mediaUrl">URL da Mídia (Imagem/Vídeo - opcional)</Label>
                            <Input id="mediaUrl" {...form.register('mediaUrl')} placeholder="https://..." disabled={form.formState.isSubmitting}/>
                            {form.formState.errors.mediaUrl && <p className="text-sm text-destructive mt-1">{form.formState.errors.mediaUrl.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="link">URL do Link (opcional)</Label>
                            <Input id="link" {...form.register('link')} placeholder="https://..." disabled={form.formState.isSubmitting}/>
                            {form.formState.errors.link && <p className="text-sm text-destructive mt-1">{form.formState.errors.link.message}</p>}
                        </div>

                        <Separator />
                        <div>
                            <Label>Destinatários</Label>
                            <Button type="button" variant="outline" className="w-full justify-start text-left mt-2" onClick={() => setIsSelectionModalOpen(true)}>
                               <Users className="mr-2 h-4 w-4" />
                               <span>{getRecipientDescription(watchRecipientIds)}</span>
                            </Button>
                            {form.formState.errors.recipientIds && <p className="text-sm text-destructive mt-1">{form.formState.errors.recipientIds.message as string}</p>}
                        </div>

                        <DialogFooter className="mt-6">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={form.formState.isSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                  </div>
                </ScrollArea>
                </DialogContent>
            </Dialog>
            <RecipientSelectionModal
                isOpen={isSelectionModalOpen}
                onClose={() => setIsSelectionModalOpen(false)}
                allCollaborators={collaborators}
                selectedIds={watchRecipientIds}
                onConfirm={(newIds) => {
                    form.setValue('recipientIds', newIds, { shouldValidate: true });
                    setIsSelectionModalOpen(false);
                }}
            />
             <ReadStatusDialog 
                message={viewingStatusFor}
                recipients={viewingStatusRecipients}
                onOpenChange={(isOpen) => !isOpen && setViewingStatusFor(null)}
            />
        </Card>
    );
}

    


"use client";

import React, { useState, useMemo, useRef } from 'react';
import { useFabMessages, type FabMessageType, type FabMessagePayload, campaignSchema, campaignTags, CampaignType } from '@/contexts/FabMessagesContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Loader2, Send, Edit2, AlertTriangle, Search, Filter, ChevronUp, ChevronDown, Upload, FileDown, GripVertical, Archive, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { getCollaboratorUserId, useCollaborators, type Collaborator } from '@/contexts/CollaboratorsContext';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '../ui/dropdown-menu';
import Papa from 'papaparse';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { CampaignLogModal } from './CampaignLogModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { formatISO } from 'date-fns';
import { findCollaboratorByEmail } from '@/lib/email-utils';


const formSchema = z.object({
    pipeline: z.array(campaignSchema).min(1, "O pipeline deve ter pelo menos uma campanha."),
});

type FabMessageFormValues = z.infer<typeof formSchema>;
type SortKey = keyof Collaborator | 'status';


const statusOptions: { [key: string]: { label: string, className: string } } = {
    ready: { label: 'Pronto para Envio', className: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-200 dark:border-cyan-800' },
    pending_cta: { label: 'Aguardando Clique', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800' },
    pending_follow_up: { label: 'Aguardando Follow-up', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-800' },
    completed: { label: 'Concluído', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800' },
    not_created: { label: 'Não Criada', className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700/50 dark:text-gray-200 dark:border-gray-600' },
};


const campaignStatusBadgeClasses: Record<CampaignType['status'], string> = {
    loaded: "bg-gray-200 text-gray-800 hover:bg-gray-200",
    active: "bg-yellow-200 text-yellow-800 hover:bg-yellow-200",
    completed: "bg-green-200 text-green-800 hover:bg-green-200",
    interrupted: "bg-red-200 text-red-800 hover:bg-red-200",
};


const StatusBadge = ({ status }: { status: keyof typeof statusOptions }) => {
    const config = statusOptions[status];
    if (!config) {
        return <Badge variant="outline">Desconhecido</Badge>;
    }
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
};

export function ManageFabMessages() {
    const { fabMessages, upsertMessageForUser, startCampaign, archiveMultipleCampaigns } = useFabMessages();
    const { collaborators } = useCollaborators();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Collaborator | null>(null);
    const [logViewingUser, setLogViewingUser] = useState<FabMessageType | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pipelineSearchTerm, setPipelineSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isSendingBulk, setIsSendingBulk] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);


    const [filters, setFilters] = useState<{
        area: string[],
        position: string[],
        segment: string[],
        leader: string[],
        status: string[],
    }>({ area: [], position: [], segment: [], leader: [], status: [] });

    const commercialUsers = useMemo(() => {
        const testUsers = [
            'desenvolvedor@3ariva.com.br',
            'matheus@3ainvestimentos.com.br'
        ];
        return collaborators.filter(c => c.axis === 'Comercial' || testUsers.includes(c.email));
    }, [collaborators]);
    
    const { uniqueAreas, uniquePositions, uniqueSegments, uniqueLeaders } = useMemo(() => {
        const areas = new Set<string>();
        const positions = new Set<string>();
        const segments = new Set<string>();
        const leaders = new Set<string>();
        commercialUsers.forEach(c => {
            areas.add(c.area);
            positions.add(c.position);
            segments.add(c.segment);
            leaders.add(c.leader);
        });
        return {
            uniqueAreas: [...areas].sort(),
            uniquePositions: [...positions].sort(),
            uniqueSegments: [...segments].sort(),
            uniqueLeaders: [...leaders].sort(),
        }
    }, [commercialUsers]);

    const userMessageMap = useMemo(() => {
        const map = new Map<string, FabMessageType>();
        fabMessages.forEach(msg => map.set(msg.userId, msg));
        return map;
    }, [fabMessages]);

     const filteredAndSortedUsers = useMemo(() => {
        let items = [...commercialUsers];

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            items = items.filter(user => {
                const name = (user.name && typeof user.name === 'string') ? user.name.toLowerCase() : '';
                const email = (user.email && typeof user.email === 'string') ? user.email.toLowerCase() : '';
                return name.includes(lowercasedTerm) || 
                       email.includes(lowercasedTerm);
            });
        }
        
        Object.entries(filters).forEach(([key, values]) => {
            if (values.length > 0) {
                 if (key === 'status') {
                    items = items.filter(user => {
                        const message = userMessageMap.get(getCollaboratorUserId(user) || '');
                        const status = message?.status || 'not_created';
                        return values.includes(status);
                    });
                } else {
                    items = items.filter(user => values.includes(user[key as keyof Collaborator] as string));
                }
            }
        });
        
        items.sort((a, b) => {
            let valA: unknown;
            let valB: unknown;
            
            if (sortKey === 'status') {
                 const messageA = userMessageMap.get(getCollaboratorUserId(a) || '');
                 const messageB = userMessageMap.get(getCollaboratorUserId(b) || '');
                 valA = messageA?.status || 'not_created';
                 valB = messageB?.status || 'not_created';
            } else {
                 valA = a[sortKey as keyof Collaborator];
                 valB = b[sortKey as keyof Collaborator];
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
            if (comparableA > comparableB) comparison = 1;
            else if (comparableA < comparableB) comparison = -1;

            return sortDirection === 'asc' ? comparison : -comparison;
        });


        return items;
    }, [commercialUsers, userMessageMap, searchTerm, filters, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    const handleFilterChange = (filterKey: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const currentValues = prev[filterKey];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterKey]: newValues };
        });
    };

    const handleBulkStartCampaign = async () => {
        if (selectedUserIds.length === 0) return;
        setIsSendingBulk(true);
        const promises = selectedUserIds.map(userId => startCampaign(userId));
        try {
            await Promise.all(promises);
            toast({
                title: "Sucesso!",
                description: `${selectedUserIds.length} campanha(s) enviada(s) para os colaboradores.`,
                variant: 'success'
            });
            setSelectedUserIds([]);
        } catch (error) {
            toast({
                title: "Erro ao Enviar em Lote",
                description: (error as Error).message,
                variant: "destructive"
            });
        } finally {
            setIsSendingBulk(false);
        }
    };
    
    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            const readyUserIds = filteredAndSortedUsers
                .filter(user => {
                    const message = userMessageMap.get(getCollaboratorUserId(user) || '');
                    return message?.status === 'ready';
                })
                .map(user => getCollaboratorUserId(user))
                .filter((id): id is string => !!id);
            setSelectedUserIds(readyUserIds);
        } else {
            setSelectedUserIds([]);
        }
    };
    
    const isAllReadyUsersSelected = useMemo(() => {
        const readyUserIds = filteredAndSortedUsers
            .filter(user => userMessageMap.get(getCollaboratorUserId(user) || '')?.status === 'ready')
            .map(user => getCollaboratorUserId(user))
            .filter((id): id is string => !!id);
        return readyUserIds.length > 0 && readyUserIds.every(id => selectedUserIds.includes(id));
    }, [filteredAndSortedUsers, selectedUserIds, userMessageMap]);

    const form = useForm<FabMessageFormValues>({
        resolver: zodResolver(formSchema),
    });
    
    const { formState: { isSubmitting }, reset, handleSubmit, control } = form;
    const { fields, append, move } = useFieldArray({ control, name: "pipeline" });
    
    const filteredPipelineFields = useMemo(() => {
        if (!pipelineSearchTerm) {
            return fields.map((field, index) => ({ ...field, originalIndex: index }));
        }
        const lowercasedTerm = pipelineSearchTerm.toLowerCase();
        return fields
            .map((field, index) => ({ ...field, originalIndex: index }))
            .filter(field => {
                const ctaMessage = (field.ctaMessage && typeof field.ctaMessage === 'string') ? field.ctaMessage.toLowerCase() : '';
                const followUpMessage = (field.followUpMessage && typeof field.followUpMessage === 'string') ? field.followUpMessage.toLowerCase() : '';
                return ctaMessage.includes(lowercasedTerm) || 
                       followUpMessage.includes(lowercasedTerm);
            });
    }, [fields, pipelineSearchTerm]);

    const handleArchiveCampaignClick = async () => {
        if (!editingUser || selectedCampaignIds.length === 0) return;
        setIsArchiving(true);
        
        try {
            await archiveMultipleCampaigns(getCollaboratorUserId(editingUser) || '', selectedCampaignIds);
            toast({ title: 'Campanhas arquivadas com sucesso!' });
            setSelectedCampaignIds([]);
        } catch (error) {
            toast({ title: 'Erro ao arquivar', description: (error as Error).message, variant: 'destructive' });
        } finally {
            setIsArchiving(false);
        }
    };
    
    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        move(result.source.index, result.destination.index);
    };

    const handleOpenForm = (user: Collaborator) => {
        setEditingUser(user);
        setSelectedCampaignIds([]);
        setPipelineSearchTerm(''); // Reset search on open
        const existingMessage = userMessageMap.get(getCollaboratorUserId(user) || '');
        if (existingMessage && existingMessage.pipeline) {
            reset({ pipeline: existingMessage.pipeline });
        } else {
             reset({
                pipeline: [{
                    id: `campaign_${Date.now()}`,
                    ctaMessage: '',
                    followUpMessage: '',
                    tag: 'Relacionamento',
                    status: 'loaded',
                }]
            });
        }
        setIsFormOpen(true);
    };

    const onSubmit = async (data: FabMessageFormValues) => {
        if (!editingUser) return;
    
        const payload: FabMessagePayload = {
            userId: getCollaboratorUserId(editingUser) || '',
            userName: editingUser.name,
            pipeline: data.pipeline,
        };
    
        try {
            await upsertMessageForUser(getCollaboratorUserId(editingUser) || '', payload);
            toast({ title: "Sucesso", description: `Pipeline de mensagens para ${editingUser.name} foi salvo.` });
            setIsFormOpen(false);
        } catch {
            toast({ title: "Erro", description: "Não foi possível salvar o pipeline.", variant: "destructive" });
        }
    };
    
    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);

        Papa.parse<{ [key: string]: string }>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const requiredHeaders = ['userEmail', 'ctaMessage', 'followUpMessage', 'tag'];
                if (!requiredHeaders.every(h => results.meta.fields?.includes(h))) {
                    toast({ title: "Erro de Cabeçalho", description: `O CSV deve conter as colunas: ${requiredHeaders.join(', ')}`, variant: "destructive", duration: 10000 });
                    setIsImporting(false);
                    return;
                }

                const userCampaigns: { [userId: string]: { userName: string, campaigns: CampaignType[] } } = {};

                for (const row of results.data) {
                    const user = findCollaboratorByEmail(collaborators, row.userEmail?.trim());
                    if (!user) {
                        console.warn(`Usuário não encontrado para o email: ${row.userEmail}`);
                        continue;
                    }
                    
                    const tag = row.tag as typeof campaignTags[number];
                    if (!campaignTags.includes(tag)) {
                        console.warn(`Tag inválida "${tag}" para o usuário ${user.email}. Usando 'Relacionamento' como padrão.`);
                    }

                    const campaign: CampaignType = {
                        id: `campaign_${Date.now()}_${Math.random()}`,
                        ctaMessage: row.ctaMessage,
                        followUpMessage: row.followUpMessage,
                        tag: campaignTags.includes(tag) ? tag : 'Relacionamento',
                        status: 'loaded',
                    };
                    
                    const userId = getCollaboratorUserId(user);
                    if (!userId) continue;
                    if (!userCampaigns[userId]) {
                        userCampaigns[userId] = { userName: user.name, campaigns: [] };
                    }
                    userCampaigns[userId].campaigns.push(campaign);
                }

                try {
                    const upsertPromises = Object.entries(userCampaigns).map(([userId, { userName, campaigns }]) => {
                        const payload: FabMessagePayload = {
                            userId,
                            userName,
                            pipeline: campaigns,
                            status: 'ready', // Default to ready
                            activeCampaignIndex: 0,
                            archivedCampaigns: [],
                        };
                        return upsertMessageForUser(userId, payload);
                    });
                    
                    await Promise.all(upsertPromises);
                    toast({ title: "Importação Concluída!", description: `${Object.keys(userCampaigns).length} pipelines de usuário foram criados/atualizados.` });
                    setIsImportOpen(false);

                } catch (e) {
                    toast({ title: "Erro na Importação", description: (e as Error).message, variant: "destructive" });
                } finally {
                    setIsImporting(false);
                }
            },
            error: (err) => {
                toast({ title: "Erro ao Ler Arquivo", description: err.message, variant: "destructive" });
                setIsImporting(false);
            }
        });
    };

    const SortableHeader = ({ tKey, label }: { tKey: SortKey, label: string }) => (
        <TableHead onClick={() => handleSort(tKey)} className="cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-1">
                {label}
                {sortKey === tKey && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
            </div>
        </TableHead>
    );

    const FilterableHeader = ({ fkey, label, uniqueValues }: { fkey: keyof typeof filters, label: string, uniqueValues: string[] | readonly { value: string, label: string }[] }) => (
        <TableHead>
            <div className="flex items-center gap-2">
                <span className="flex-grow">{label}</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Filtrar por {label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="max-h-60">
                        {uniqueValues.map(item => {
                            const value = typeof item === 'string' ? item : item.value;
                            const displayLabel = typeof item === 'string' ? item : item.label;
                            return (
                            <DropdownMenuCheckboxItem
                                key={value}
                                checked={filters[fkey].includes(value)}
                                onCheckedChange={() => handleFilterChange(fkey, value)}
                            >
                                {displayLabel}
                            </DropdownMenuCheckboxItem>
                        )})}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </TableHead>
    );

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Gerenciamento de Mensagens por Colaborador</CardTitle>
                <CardDescription>
                Crie, envie e monitore as campanhas de comunicação. O status &apos;Pronto&apos; indica que a campanha está aguardando o envio manual.
                </CardDescription>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
                    <div className="relative flex-grow w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por colaborador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex w-full sm:w-auto flex-wrap gap-2">
                        <Button variant="outline" onClick={handleBulkStartCampaign} disabled={selectedUserIds.length === 0 || isSendingBulk}>
                            {isSendingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                            Enviar para Selecionados ({selectedUserIds.length})
                        </Button>
                        <Button onClick={() => setIsImportOpen(true)} variant="outline" className="flex-grow">
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                            Importar CSV
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".csv"
                            onChange={handleFileImport}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={isAllReadyUsersSelected}
                                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                        aria-label="Selecionar todos os usuários prontos"
                                    />
                                </TableHead>
                                <SortableHeader tKey="name" label="Colaborador" />
                                <FilterableHeader fkey="area" label="Área" uniqueValues={uniqueAreas}/>
                                <FilterableHeader fkey="position" label="Cargo" uniqueValues={uniquePositions}/>
                                <FilterableHeader fkey="segment" label="Segmento" uniqueValues={uniqueSegments}/>
                                <FilterableHeader fkey="leader" label="Líder" uniqueValues={uniqueLeaders}/>
                                <FilterableHeader fkey="status" label="Status" uniqueValues={Object.entries(statusOptions).map(([value, {label}]) => ({value, label}))}/>
                                <TableHead>Progresso</TableHead>
                                <TableHead>Acompanhamento</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedUsers.map(user => {
                                const message = userMessageMap.get(getCollaboratorUserId(user) || '');
                                
                                const finishedCampaigns = message?.pipeline.filter(c => c.status === 'completed' || c.status === 'interrupted').length || 0;
                                const totalInPipeline = message?.pipeline.length || 0;
                                const progressText = `${finishedCampaigns}/${totalInPipeline}`;

                                const isReady = message?.status === 'ready';
                                return (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedUserIds.includes(getCollaboratorUserId(user) || '')}
                                            onCheckedChange={(checked) => {
                                                setSelectedUserIds(prev =>
                                                    checked
                                                      ? [...prev, getCollaboratorUserId(user) || '']
                                                      : prev.filter(id => id !== (getCollaboratorUserId(user) || ''))
                                                );
                                            }}
                                            aria-label={`Selecionar ${user.name}`}
                                            disabled={!isReady}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.area}</TableCell>
                                    <TableCell>{user.position}</TableCell>
                                    <TableCell>{user.segment}</TableCell>
                                    <TableCell>{user.leader}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={message?.status || 'not_created'} />
                                    </TableCell>
                                    <TableCell>
                                        {message ? progressText : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        {message && (
                                            <Button variant="ghost" size="icon" onClick={() => setLogViewingUser(message)} className="hover:bg-muted">
                                                <History className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenForm(user)} className="hover:bg-admin-primary/10 hover:text-admin-primary">
                                            <Edit2 className="mr-2 h-4 w-4"/> Gerenciar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Configurar Pipeline para</DialogTitle>
                    <DialogDescription>{editingUser?.name}</DialogDescription>
                </DialogHeader>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar campanha por código ou palavra-chave..."
                        value={pipelineSearchTerm}
                        onChange={(e) => setPipelineSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="flex-grow flex flex-col min-h-0">
                    <div className="flex-grow overflow-y-auto pr-4 -mr-4">
                       <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="pipelineDroppable">
                                {(provided) => (
                                <Table {...provided.droppableProps} ref={provided.innerRef}>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10"><GripVertical className="h-4 w-4 text-muted-foreground"/></TableHead>
                                            <TableHead className="w-10">
                                                <Checkbox
                                                    checked={selectedCampaignIds.length > 0 && selectedCampaignIds.length === filteredPipelineFields.length}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedCampaignIds(checked ? filteredPipelineFields.map(f => f.id) : []);
                                                    }}
                                                />
                                            </TableHead>
                                            <TableHead>ID</TableHead>
                                            <TableHead>CTA</TableHead>
                                            <TableHead>Follow-up</TableHead>
                                            <TableHead>Tag</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Efetiva?</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPipelineFields.map((field) => (
                                            <Draggable key={field.id} draggableId={field.id} index={field.originalIndex}>
                                            {(provided) => (
                                                <TableRow ref={provided.innerRef} {...provided.draggableProps}>
                                                    <TableCell {...provided.dragHandleProps} className="cursor-grab"><GripVertical className="h-4 w-4 text-muted-foreground"/></TableCell>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedCampaignIds.includes(field.id)}
                                                            onCheckedChange={(checked) => {
                                                                setSelectedCampaignIds(prev => checked ? [...prev, field.id] : prev.filter(id => id !== field.id))
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{field.id.slice(-8)}</TableCell>
                                                    <TableCell>
                                                        <Textarea {...form.register(`pipeline.${field.originalIndex}.ctaMessage`)} rows={2} disabled={field.status === 'completed'} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Textarea {...form.register(`pipeline.${field.originalIndex}.followUpMessage`)} rows={2} disabled={field.status === 'completed'} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Controller
                                                            name={`pipeline.${field.originalIndex}.tag`}
                                                            control={control}
                                                            render={({ field: controllerField }) => (
                                                                <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value} disabled={field.status === 'completed'}>
                                                                    <SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger>
                                                                    <SelectContent>
                                                                        {campaignTags.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={campaignStatusBadgeClasses[field.status]}>{field.status}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Controller
                                                            name={`pipeline.${field.originalIndex}.effectiveAt`}
                                                            control={control}
                                                            render={({ field: { value, onChange } }) => (
                                                                <Checkbox 
                                                                    checked={!!value} 
                                                                    onCheckedChange={(checked) => 
                                                                        onChange(checked ? formatISO(new Date()) : undefined)
                                                                    } 
                                                                />
                                                            )}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </TableBody>
                                </Table>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>

                    <Separator className="my-4" />
                    
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `campaign_${Date.now()}`, ctaMessage: '', followUpMessage: '', tag: 'Relacionamento', status: 'loaded' })} className="mt-2 bg-gray-200 hover:bg-gray-300 font-bold">
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Campanha ao Pipeline
                    </Button>

                    <DialogFooter className="!justify-between mt-6 pt-4 border-t">
                         <div>
                            <Button type="button" variant="destructive" size="sm" onClick={handleArchiveCampaignClick} disabled={isArchiving || selectedCampaignIds.length === 0}>
                                {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Archive className="mr-2 h-4 w-4"/>}
                                Arquivar Selecionadas ({selectedCampaignIds.length})
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Salvar Pipeline
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importar Campanhas via CSV</DialogTitle>
                    <DialogDescription>
                        Faça o upload de um arquivo CSV para criar ou substituir pipelines de campanhas para múltiplos usuários.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="p-4 rounded-md border border-amber-500/50 bg-amber-500/10 text-amber-700">
                    <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-600 flex-shrink-0"/>
                            <div>
                                <p className="font-semibold">Atenção: A importação irá sobrescrever o pipeline existente para os e-mails informados no arquivo.</p>
                            </div>
                    </div>
                    </div>

                    <h3 className="font-semibold">Instruções:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Crie uma planilha com uma linha para **cada campanha** de um usuário.</li>
                        <li>A primeira linha **deve** ser um cabeçalho com os seguintes nomes de coluna, exatamente como mostrado:
                            <code className="block bg-muted p-2 rounded-md my-2 text-xs">userEmail,ctaMessage,followUpMessage,tag</code>
                        </li>
                        <li>Para criar um pipeline para um usuário, adicione múltiplas linhas com o mesmo `userEmail`. A ordem das linhas no arquivo definirá a ordem do pipeline.</li>
                        <li>O valor da coluna `tag` deve corresponder a uma das opções: {campaignTags.join(', ')}.</li>
                        <li>Exporte ou salve o arquivo no formato **CSV (Valores Separados por Vírgula)**.</li>
                    </ol>
                    <a href="/templates/modelo_campanhas_fab.csv" download className="inline-block" >
                        <Button variant="secondary">
                            <FileDown className="mr-2 h-4 w-4"/>
                            Baixar Modelo CSV
                        </Button>
                    </a>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={isImporting}>
                        Cancelar
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                        {isImporting ? 'Importando...' : 'Selecionar Arquivo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <CampaignLogModal
            message={logViewingUser}
            isOpen={!!logViewingUser}
            onClose={() => setLogViewingUser(null)}
        />
        </>
    );
}

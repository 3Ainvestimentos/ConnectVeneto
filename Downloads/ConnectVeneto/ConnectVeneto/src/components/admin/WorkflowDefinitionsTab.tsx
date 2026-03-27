
"use client";

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useApplications, WorkflowDefinition, workflowDefinitionSchema } from '@/contexts/ApplicationsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, Loader2, Upload, User, Users, FolderOpen, Filter, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getIcon } from '@/lib/icons';
import { WorkflowDefinitionForm } from '@/components/admin/WorkflowDefinitionForm';
import { ZodError } from 'zod';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import ManageWorkflowAreas from '@/components/admin/ManageWorkflowAreas';
import { useWorkflowAreas } from '@/contexts/WorkflowAreasContext';
import { Input } from '../ui/input';
import { findCollaboratorByEmail, normalizeEmail } from '@/lib/email-utils';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';

type SortKey = 'name' | 'areaId' | 'ownerEmail';

export function WorkflowDefinitionsTab() {
    const { workflowDefinitions, deleteWorkflowDefinitionMutation, addWorkflowDefinition } = useApplications();
    const { collaborators } = useCollaborators();
    const { workflowAreas } = useWorkflowAreas();
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDefinition, setEditingDefinition] = useState<WorkflowDefinition | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [areaFilter, setAreaFilter] = useState<string[]>([]);
    const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const getAreaName = useCallback((areaId: string) => {
        return workflowAreas.find(a => a.id === areaId)?.name || 'N/A';
    }, [workflowAreas]);

    const getOwnerName = useCallback((email: string) => {
        return findCollaboratorByEmail(collaborators, email)?.name || email;
    }, [collaborators]);

    const uniqueAreas = useMemo(() => {
        const areaIds = new Set(workflowDefinitions.map(def => def.areaId));
        return workflowAreas.filter(area => areaIds.has(area.id));
    }, [workflowDefinitions, workflowAreas]);

    const uniqueOwners = useMemo(() => {
        const ownerEmails = new Set(workflowDefinitions.map(def => normalizeEmail(def.ownerEmail)).filter(Boolean));
        return collaborators.filter(c => {
            const normalized = normalizeEmail(c.email);
            return normalized && ownerEmails.has(normalized);
        });
    }, [workflowDefinitions, collaborators]);

    const filteredAndSortedDefinitions = useMemo(() => {
        let items = [...workflowDefinitions];

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            items = items.filter(def => {
                const name = (def.name && typeof def.name === 'string') ? def.name.toLowerCase() : '';
                return name.includes(lowerSearchTerm);
            });
        }
        if (areaFilter.length > 0) {
            items = items.filter(def => areaFilter.includes(def.areaId));
        }
        if (ownerFilter.length > 0) {
            const normalizedOwnerFilter = new Set(ownerFilter.map(email => normalizeEmail(email)).filter(Boolean));
            items = items.filter(def => {
                const normalizedOwnerEmail = normalizeEmail(def.ownerEmail);
                return normalizedOwnerEmail && normalizedOwnerFilter.has(normalizedOwnerEmail);
            });
        }
        
        if (sortKey) {
            items.sort((a, b) => {
                if (sortKey === 'name') {
                    return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                }
                if (sortKey === 'areaId') {
                    return sortDirection === 'asc' ? getAreaName(a.areaId).localeCompare(getAreaName(b.areaId)) : getAreaName(b.areaId).localeCompare(getAreaName(a.areaId));
                }
                if (sortKey === 'ownerEmail') {
                    return sortDirection === 'asc' ? getOwnerName(a.ownerEmail).localeCompare(getOwnerName(b.ownerEmail)) : getOwnerName(b.ownerEmail).localeCompare(getOwnerName(a.ownerEmail));
                }
                return 0;
            });
        }


        return items;
    }, [workflowDefinitions, searchTerm, areaFilter, ownerFilter, sortKey, sortDirection, getAreaName, getOwnerName]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleOpenForm = (definition: WorkflowDefinition | null) => {
        setEditingDefinition(definition);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir esta definição de workflow? Todas as solicitações associadas permanecerão, mas não será possível criar novas.")) return;
        try {
            await deleteWorkflowDefinitionMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Definição de workflow excluída." });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
            toast({ title: "Falha na Exclusão", description: errorMessage, variant: "destructive" });
        }
    };
    
    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text || text.trim() === '') {
                    throw new Error("O arquivo JSON está vazio ou é inválido.");
                }
                const jsonData = JSON.parse(text) as Record<string, unknown>;

                if (jsonData.slaDays && !jsonData.defaultSlaDays) {
                    jsonData.defaultSlaDays = jsonData.slaDays;
                    delete jsonData.slaDays;
                }

                if (jsonData.routingRules && Array.isArray(jsonData.routingRules)) {
                    jsonData.routingRules = jsonData.routingRules.filter((rule: unknown) =>
                        typeof rule === 'object' && rule !== null && 'field' in rule && 'value' in rule
                    );
                }
                
                if (jsonData.slaRules && Array.isArray(jsonData.slaRules)) {
                    jsonData.slaRules = jsonData.slaRules.filter((rule: unknown) =>
                        typeof rule === 'object' &&
                        rule !== null &&
                        'field' in rule &&
                        'value' in rule &&
                        'days' in rule &&
                        (rule as { days?: unknown }).days !== undefined
                    );
                }
                
                if (!jsonData.allowedUserIds) {
                    jsonData.allowedUserIds = ['all'];
                }
                
                if (!jsonData.areaId) {
                    throw new Error("O arquivo JSON é de um formato antigo e não contém 'areaId'. Por favor, atualize o arquivo ou crie o workflow manualmente.");
                }

                const parsedData = workflowDefinitionSchema.parse(jsonData);

                await addWorkflowDefinition(parsedData);

                toast({
                    title: "Importação Concluída!",
                    description: `O workflow '${parsedData.name}' foi adicionado com sucesso.`,
                });
            } catch (error) {
                console.error("Erro na importação de Workflow:", error);
                let description = "Ocorreu um erro desconhecido.";
                if (error instanceof SyntaxError) {
                    description = "O arquivo JSON possui um formato inválido.";
                } else if (error instanceof ZodError) {
                    description = `Erro de validação: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
                } else if (error instanceof Error) {
                    description = error.message;
                }
                toast({
                    title: "Erro na Importação",
                    description: description,
                    variant: "destructive",
                });
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        
        reader.onerror = () => {
             toast({
                title: "Erro de Leitura",
                description: "Não foi possível ler o arquivo selecionado.",
                variant: "destructive",
            });
            setIsImporting(false);
        };

        reader.readAsText(file);
    };

    const getAccessDescription = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Ninguém';
        if (ids.includes('all')) return 'Todos';
        return `${ids.length} Colaborador(es)`;
    };
    
    type HeaderFilterItem = object;
    const FilterableHeader = <T extends HeaderFilterItem>({
        label,
        items,
        selectedItems,
        onCheckedChange,
        displayKey,
        valueKey,
    }: {
        label: string;
        items: T[];
        selectedItems: string[];
        onCheckedChange: (value: string) => void;
        displayKey: keyof T;
        valueKey: keyof T;
    }) => (
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
                        {items.map((item) => (
                            <DropdownMenuCheckboxItem
                                key={String(item[valueKey])}
                                checked={selectedItems.includes(String(item[valueKey]))}
                                onCheckedChange={() => onCheckedChange(String(item[valueKey]))}
                            >
                                {String(item[displayKey])}
                            </DropdownMenuCheckboxItem>
                        ))}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </TableHead>
    );

    return (
        <div className="space-y-6">
            <ManageWorkflowAreas />
            <Separator />
            <Card>
                <CardHeader>
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Definições de Workflow</CardTitle>
                            <CardDescription>
                                {filteredAndSortedDefinitions.length} de {workflowDefinitions.length} workflow(s) exibido(s).
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
                             <div className="relative flex-grow">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por nome..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 w-full"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-grow" disabled={isImporting}>
                                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                    {isImporting ? 'Importando...' : 'Importar JSON'}
                                </Button>
                                 <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".json"
                                    onChange={handleFileImport}
                                />
                                <Button onClick={() => handleOpenForm(null)} className="bg-admin-primary hover:bg-admin-primary/90 flex-grow">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Nova Definição
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">Ícone</TableHead>
                                    <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50">
                                        <div className="flex items-center gap-1">
                                            Nome
                                            {sortKey === 'name' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                                        </div>
                                    </TableHead>
                                    <FilterableHeader
                                        label="Área"
                                        items={uniqueAreas}
                                        selectedItems={areaFilter}
                                        onCheckedChange={(id: string) => setAreaFilter(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])}
                                        displayKey="name"
                                        valueKey="id"
                                    />
                                    <FilterableHeader
                                        label="Proprietário"
                                        items={uniqueOwners}
                                        selectedItems={ownerFilter}
                                        onCheckedChange={(email: string) => setOwnerFilter(prev => prev.includes(email) ? prev.filter(p => p !== email) : [...prev, email])}
                                        displayKey="name"
                                        valueKey="email"
                                    />
                                    <TableHead>Acesso</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedDefinitions.map(def => {
                                    const Icon = getIcon(def.icon);
                                    return (
                                        <TableRow key={def.id}>
                                            <TableCell><Icon className="h-5 w-5 text-muted-foreground" /></TableCell>
                                            <TableCell className="font-medium">{def.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                                                  <FolderOpen className="h-3 w-3" />
                                                  {getAreaName(def.areaId)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                                                  <User className="h-3 w-3" />
                                                  {getOwnerName(def.ownerEmail)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={def.allowedUserIds?.includes('all') ? 'outline' : 'secondary'} className="flex items-center gap-1.5 w-fit">
                                                  <Users className="h-3 w-3" />
                                                  {getAccessDescription(def.allowedUserIds || ['all'])}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenForm(def)} className="hover:bg-muted">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(def.id)} className="hover:bg-muted" disabled={deleteWorkflowDefinitionMutation.isPending && deleteWorkflowDefinitionMutation.variables === def.id}>
                                                    {deleteWorkflowDefinitionMutation.isPending && deleteWorkflowDefinitionMutation.variables === def.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                     {filteredAndSortedDefinitions.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">
                            Nenhuma definição de workflow encontrada para os filtros aplicados.
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {isFormOpen && (
                <WorkflowDefinitionForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    definition={editingDefinition}
                />
            )}
        </div>
    );
}

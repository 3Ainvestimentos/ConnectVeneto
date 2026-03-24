
"use client";
import React, { useState, useRef, useMemo } from 'react';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import type { Collaborator, BILink } from '@/contexts/CollaboratorsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Upload, FileDown, AlertTriangle, Search, ChevronUp, ChevronDown, Clock, Link as LinkIcon, Folder, BarChart, GripVertical, Filter, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import Papa from 'papaparse';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { CollaboratorAuditLogModal } from './CollaboratorAuditLogModal';

const biLinkSchema = z.object({
    name: z.string().min(1, "O nome da aba é obrigatório."),
    url: z.string().transform((value, ctx) => {
        if (!value) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A URL ou o código de incorporação do iframe é obrigatório.",
            });
            return z.NEVER;
        };

        if (z.string().url().safeParse(value).success) {
            return value;
        }

        if (value.trim().startsWith('<iframe')) {
            const srcMatch = value.match(/src="([^"]+)"/);
            if (srcMatch && srcMatch[1]) {
                const url = srcMatch[1];
                if (z.string().url().safeParse(url).success) {
                    return url;
                }
            }
        }

        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "URL inválida. Cole a URL completa ou o código de incorporação do iframe.",
        });
        return z.NEVER;
    })
});

const collaboratorSchema = z.object({
    id: z.string().optional(),
    id3a: z.string().min(1, "ID Veneto é obrigatório"),
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    photoURL: z.string().url("URL da imagem inválida").optional().or(z.literal('')),
    axis: z.string().min(1, "Eixo é obrigatório"),
    area: z.string().min(1, "Área é obrigatória"),
    position: z.string().min(1, "Cargo é obrigatório"),
    segment: z.string().min(1, "Segmento é obrigatório"),
    leader: z.string().min(1, "Líder é obrigatório"),
    city: z.string().min(1, "Cidade é obrigatória"),
    googleDriveLinks: z.union([z.string(), z.array(z.string().url("URL inválida."))]).optional(),
    biLinks: z.array(biLinkSchema).optional(),
});

type CollaboratorFormValues = z.infer<typeof collaboratorSchema>;

type CsvRow = { [key: string]: string };

type SortKey = keyof Collaborator | '';
type SortDirection = 'asc' | 'desc';

export function ManageCollaborators() {
    const { collaborators, addCollaborator, updateCollaborator, deleteCollaboratorMutation, addMultipleCollaborators } = useCollaborators();
    const { settings } = useSystemSettings();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [filters, setFilters] = useState<{ area: string[], position: string[], axis: string[], segment: string[], leader: string[], city: string[] }>({ area: [], position: [], axis: [], segment: [], leader: [], city: [] });

    const { control, register, handleSubmit, reset, formState: { errors, isSubmitting: isFormSubmitting } } = useForm<CollaboratorFormValues>({
        resolver: zodResolver(collaboratorSchema),
    });

    const { fields: biLinksFields, append, remove } = useFieldArray({
        control,
        name: "biLinks",
    });

    const lastAddedCollaborator = useMemo(() => {
        if (collaborators.length === 0) return null;
        
        return [...collaborators]
            .filter(c => c.createdAt)
            .sort((a, b) => parseISO(b.createdAt!).getTime() - parseISO(a.createdAt!).getTime())[0];
            
    }, [collaborators]);

    const { uniqueAreas, uniquePositions, uniqueAxes, uniqueSegments, uniqueLeaders, uniqueCities } = useMemo(() => {
        const areas = new Set<string>();
        const positions = new Set<string>();
        const axes = new Set<string>();
        const segments = new Set<string>();
        const leaders = new Set<string>();
        const cities = new Set<string>();
        collaborators.forEach(c => {
            if(c.area) areas.add(c.area);
            if(c.position) positions.add(c.position);
            if(c.axis) axes.add(c.axis);
            if(c.segment) segments.add(c.segment);
            if(c.leader) leaders.add(c.leader);
            if(c.city) cities.add(c.city);
        });
        return {
            uniqueAreas: [...areas].sort(),
            uniquePositions: [...positions].sort(),
            uniqueAxes: [...axes].sort(),
            uniqueSegments: [...segments].sort(),
            uniqueLeaders: [...leaders].sort(),
            uniqueCities: [...cities].sort()
        };
    }, [collaborators]);

    const filteredAndSortedCollaborators = useMemo(() => {
        let items = [...collaborators];

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            items = items.filter(c => {
                const nameMatch = c.name?.toLowerCase().includes(lowercasedTerm) ?? false;
                const emailMatch = c.email?.toLowerCase().includes(lowercasedTerm) ?? false;
                const idMatch = c.idVeneto?.toLowerCase().includes(lowercasedTerm) || c.id3a?.toLowerCase().includes(lowercasedTerm) || false;
                return nameMatch || emailMatch || idMatch;
            });
        }
        
        Object.entries(filters).forEach(([key, values]) => {
            if (values.length > 0) {
                items = items.filter(c => values.includes(c[key as keyof Collaborator] as string));
            }
        });


        if (sortKey) {
            items.sort((a, b) => {
                const valA = a[sortKey as keyof Collaborator];
                const valB = b[sortKey as keyof Collaborator];
                let comparison = 0;
                if (valA && valB) {
                    comparison = String(valA).localeCompare(String(valB));
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        return items;
    }, [collaborators, searchTerm, sortKey, sortDirection, filters]);

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

    const handleFormDialogOpen = (collaborator: Collaborator | null) => {
        setEditingCollaborator(collaborator);
        if (collaborator) {
            reset({
              ...collaborator,
              googleDriveLinks: collaborator.googleDriveLinks ? collaborator.googleDriveLinks.join('\\n') : '',
              biLinks: collaborator.biLinks || [],
            });
        } else {
            reset({
                id: undefined,
                id3a: '',
                name: '',
                email: '',
                photoURL: '',
                axis: '',
                area: '',
                position: '',
                segment: '',
                leader: '',
                city: '',
                googleDriveLinks: [],
                biLinks: [],
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este colaborador?")) return;

        try {
            await deleteCollaboratorMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Colaborador excluído." });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
            toast({ title: "Falha na Exclusão", description: errorMessage, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: CollaboratorFormValues) => {
        const processedData = {
          ...data,
          idVeneto: data.id3a,
          googleDriveLinks: typeof data.googleDriveLinks === 'string'
            ? data.googleDriveLinks.split('\\n').map(link => link.trim()).filter(Boolean)
            : data.googleDriveLinks || []
        };
        
        try {
            if (editingCollaborator) {
                await updateCollaborator(editingCollaborator, processedData);
                toast({ title: "Colaborador atualizado com sucesso." });
            } else {
                const { id, ...dataWithoutId } = processedData;
                await addCollaborator(dataWithoutId as Omit<Collaborator, 'id'>);
                toast({ title: "Colaborador adicionado com sucesso." });
            }
            setIsFormOpen(false);
            setEditingCollaborator(null);
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                description: error instanceof Error ? error.message : "Não foi possível salvar o colaborador.",
                variant: "destructive"
            });
        }
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);

        Papa.parse<CsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const fileHeaders = results.meta.fields;
                const hasLegacyId = !!fileHeaders?.includes('id3a');
                const hasVenetoId = !!fileHeaders?.includes('idVeneto');
                const requiredBaseHeaders = ['name', 'email', 'axis', 'area', 'position', 'segment', 'leader', 'city'];

                if (!fileHeaders || !requiredBaseHeaders.every(h => fileHeaders.includes(h)) || (!hasLegacyId && !hasVenetoId)) {
                    toast({
                        title: "Erro no Arquivo CSV",
                        description: "O arquivo deve conter as colunas base e ao menos um identificador: idVeneto (preferencial) ou id3a (legado).",
                        variant: "destructive",
                    });
                    setIsImporting(false);
                    return;
                }

                const newCollaborators = results.data
                    .map(row => ({
                        id3a: (row.idVeneto || row.id3a)?.trim(),
                        idVeneto: (row.idVeneto || row.id3a)?.trim(),
                        name: row.name?.trim(),
                        email: row.email?.trim().toLowerCase(),
                        photoURL: row.photoURL?.trim() || '',
                        axis: row.axis?.trim(),
                        area: row.area?.trim(),
                        position: row.position?.trim(),
                        segment: row.segment?.trim(),
                        leader: row.leader?.trim(),
                        city: row.city?.trim(),
                        googleDriveLinks: row.googleDriveLinks?.split(',').map(l => l.trim()).filter(Boolean) || [],
                        biLinks: [],
                    }))
                    .filter(c => c.id3a && c.name && c.email); // Basic validation

                if (newCollaborators.length === 0) {
                     toast({
                        title: "Nenhum dado válido encontrado",
                        description: "Verifique o conteúdo do seu arquivo CSV.",
                        variant: "destructive",
                    });
                    setIsImporting(false);
                    return;
                }
                
                try {
                    await addMultipleCollaborators(newCollaborators as Omit<Collaborator, 'id'>[]);
                    toast({
                        title: "Importação Concluída!",
                        description: `${newCollaborators.length} colaboradores foram adicionados com sucesso.`,
                    });
                    setIsImportOpen(false);
                } catch(e) {
                     toast({
                        title: "Erro na importação",
                        description: e instanceof Error ? e.message : "Ocorreu um erro desconhecido.",
                        variant: "destructive",
                    });
                } finally {
                    setIsImporting(false);
                }
            },
            error: (error) => {
                toast({
                    title: "Erro ao processar o arquivo",
                    description: error.message,
                    variant: "destructive",
                });
                setIsImporting(false);
            }
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleExportCSV = () => {
        if (filteredAndSortedCollaborators.length === 0) {
            toast({ title: "Nenhum dado para exportar", variant: 'destructive' });
            return;
        }

        const dataToExport = filteredAndSortedCollaborators.map(c => ({
            idVeneto: c.idVeneto || c.id3a,
            name: c.name,
            email: c.email,
            photoURL: c.photoURL || '',
            axis: c.axis,
            area: c.area,
            position: c.position,
            segment: c.segment,
            leader: c.leader,
            city: c.city,
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `colaboradores_intranet_veneto_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const SortableHeader = ({ tkey, label }: { tkey: SortKey, label: string }) => (
        <TableHead>
             <button onClick={() => handleSort(tkey)} className="flex items-center gap-1 hover:text-foreground">
                {label}
                {sortKey === tkey && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
            </button>
        </TableHead>
    );
    
    const FilterableHeader = ({ fkey, label, uniqueValues }: { fkey: keyof typeof filters, label: string, uniqueValues: string[] }) => (
        <TableHead>
            <div className="flex items-center gap-2">
                <span className="flex-grow">{label}</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-60 overflow-y-auto">
                        <DropdownMenuLabel>Filtrar por {label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea>
                        {uniqueValues.map(value => (
                            <DropdownMenuCheckboxItem
                                key={value}
                                checked={filters[fkey].includes(value)}
                                onCheckedChange={() => handleFilterChange(fkey, value)}
                            >
                                {value}
                            </DropdownMenuCheckboxItem>
                        ))}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </TableHead>
    );

    return (
        <>
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                     <div className="flex-grow">
                        <CardTitle>Gerenciar Colaboradores</CardTitle>
                        <CardDescription>
                            Exibindo {filteredAndSortedCollaborators.length} de {collaborators.length} | Versão da Tabela: <Badge variant="secondary" className="font-mono">{settings.collaboratorTableVersion.toFixed(1)}</Badge>
                        </CardDescription>
                    </div>
                     <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
                        <div className="relative flex-grow sm:flex-grow-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar colaborador..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => setIsAuditLogOpen(true)} variant="outline" className="flex-grow"><History className="mr-2 h-4 w-4" />Histórico</Button>
                            <Button onClick={() => setIsImportOpen(true)} variant="outline" className="flex-grow"><Upload className="mr-2 h-4 w-4" />Importar</Button>
                            <Button onClick={handleExportCSV} variant="outline" className="flex-grow"><FileDown className="mr-2 h-4 w-4" />Exportar</Button>
                            <Button onClick={() => handleFormDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90 flex-grow"><PlusCircle className="mr-2 h-4 w-4" />Adicionar</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader tkey="name" label="Colaborador" />
                                    <FilterableHeader fkey="axis" label="Eixo" uniqueValues={uniqueAxes} />
                                    <FilterableHeader fkey="area" label="Área" uniqueValues={uniqueAreas} />
                                    <FilterableHeader fkey="position" label="Cargo" uniqueValues={uniquePositions} />
                                    <FilterableHeader fkey="segment" label="Segmento" uniqueValues={uniqueSegments} />
                                    <FilterableHeader fkey="leader" label="Líder" uniqueValues={uniqueLeaders} />
                                    <FilterableHeader fkey="city" label="Cidade" uniqueValues={uniqueCities} />
                                    <TableHead>Google Drive</TableHead>
                                    <TableHead>Links de BI</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedCollaborators.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}<br/><span className="text-xs text-muted-foreground">{item.email}</span></TableCell>
                                        <TableCell>{item.axis}</TableCell>
                                        <TableCell>{item.area}</TableCell>
                                        <TableCell>{item.position}</TableCell>
                                        <TableCell>{item.segment}</TableCell>
                                        <TableCell>{item.leader}</TableCell>
                                        <TableCell>{item.city}</TableCell>
                                        <TableCell>
                                            {item.googleDriveLinks && item.googleDriveLinks.length > 0 ? (
                                                <Badge variant="secondary" className="flex items-center w-fit gap-1.5">
                                                    <Folder className="h-3 w-3" />
                                                    {item.googleDriveLinks.length} pasta(s)
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Padrão</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.biLinks && item.biLinks.length > 0 ? (
                                                <Badge variant="secondary" className="flex items-center w-fit gap-1.5">
                                                    <BarChart className="h-3 w-3" />
                                                    {item.biLinks.length} link(s)
                                                </Badge>
                                            ) : (
                                                 <Badge variant="outline">Nenhum</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleFormDialogOpen(item)} className="hover:bg-muted">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="hover:bg-muted" disabled={deleteCollaboratorMutation.isPending && deleteCollaboratorMutation.variables === item.id}>
                                                {deleteCollaboratorMutation.isPending && deleteCollaboratorMutation.variables === item.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     {filteredAndSortedCollaborators.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">Nenhum colaborador encontrado.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CollaboratorAuditLogModal isOpen={isAuditLogOpen} onClose={() => setIsAuditLogOpen(false)} />

            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingCollaborator(null); setIsFormOpen(isOpen); }}>
                <DialogContent className="max-w-2xl">
                <ScrollArea className="max-h-[80vh]">
                  <div className="p-6 pt-0">
                    <DialogHeader>
                        <DialogTitle>{editingCollaborator ? 'Editar Colaborador' : 'Adicionar Colaborador'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="id3a">ID Veneto</Label>
                                <Input id="id3a" {...register('id3a')} placeholder="Ex: VNT001" disabled={isFormSubmitting}/>
                                {errors.id3a && <p className="text-sm text-destructive mt-1">{errors.id3a.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="name">Nome</Label>
                                <Input id="name" {...register('name')} disabled={isFormSubmitting}/>
                                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" {...register('email')} placeholder="nome.sobrenome@venetomfo.com.br" disabled={isFormSubmitting}/>
                            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="photoURL">URL da Foto (opcional)</Label>
                            <Input id="photoURL" {...register('photoURL')} placeholder="https://..." disabled={isFormSubmitting}/>
                            {errors.photoURL && <p className="text-sm text-destructive mt-1">{errors.photoURL.message}</p>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="axis">Eixo</Label>
                                <Input id="axis" {...register('axis')} disabled={isFormSubmitting}/>
                                {errors.axis && <p className="text-sm text-destructive mt-1">{errors.axis.message}</p>}
                            </div>
                             <div>
                                <Label htmlFor="area">Área</Label>
                                <Input id="area" {...register('area')} disabled={isFormSubmitting}/>
                                {errors.area && <p className="text-sm text-destructive mt-1">{errors.area.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <Label htmlFor="position">Cargo</Label>
                                <Input id="position" {...register('position')} disabled={isFormSubmitting}/>
                                {errors.position && <p className="text-sm text-destructive mt-1">{errors.position.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="segment">Segmento</Label>
                                <Input id="segment" {...register('segment')} disabled={isFormSubmitting}/>
                                {errors.segment && <p className="text-sm text-destructive mt-1">{errors.segment.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="leader">Líder</Label>
                                <Input id="leader" {...register('leader')} disabled={isFormSubmitting}/>
                                {errors.leader && <p className="text-sm text-destructive mt-1">{errors.leader.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="city">Cidade</Label>
                                <Input id="city" {...register('city')} disabled={isFormSubmitting}/>
                                {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
                            </div>
                        </div>
                        <Separator/>
                         <div>
                            <Label htmlFor="googleDriveLinks">Links do Google Drive (um por linha)</Label>
                             <Textarea id="googleDriveLinks" {...register('googleDriveLinks')} placeholder="https://drive.google.com/drive/folders/...\\nhttps://drive.google.com/drive/folders/..." disabled={isFormSubmitting} rows={3}/>
                            <p className="text-xs text-muted-foreground mt-1">Deixe em branco para usar a pasta "Meu Drive" padrão.</p>
                            {errors.googleDriveLinks && <p className="text-sm text-destructive mt-1">{errors.googleDriveLinks.message}</p>}
                        </div>
                        <Separator/>
                        <div>
                            <Label>Links do Power BI (opcional)</Label>
                            <div className="space-y-3 mt-2">
                                {biLinksFields.map((field, index) => (
                                    <div key={field.id} className="p-3 border rounded-lg space-y-2 relative bg-background">
                                         <div className="flex items-end gap-2">
                                            <div className="flex-grow space-y-1.5">
                                                <Label htmlFor={`biLinks.${index}.name`}>Nome da Aba</Label>
                                                <Input id={`biLinks.${index}.name`} {...register(`biLinks.${index}.name`)} placeholder="Ex: Painel de Vendas" />
                                                {errors.biLinks?.[index]?.name && <p className="text-xs text-destructive mt-1">{errors.biLinks[index]?.name?.message}</p>}
                                            </div>
                                             <div className="flex-grow space-y-1.5">
                                                <Label htmlFor={`biLinks.${index}.url`}>URL ou Iframe do Painel</Label>
                                                <Input id={`biLinks.${index}.url`} {...register(`biLinks.${index}.url`)} placeholder="Cole a URL ou o código de incorporação" />
                                                {errors.biLinks?.[index]?.url && <p className="text-xs text-destructive mt-1">{errors.biLinks[index]?.url?.message}</p>}
                                            </div>
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} className="shrink-0"><Trash2 className="h-4 w-4"/></Button>
                                         </div>
                                    </div>
                                ))}
                            </div>
                             <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', url: '' })} className="mt-2">
                                <PlusCircle className="mr-2 h-4 w-4"/>
                                Adicionar Link de BI
                            </Button>
                        </div>
                        <DialogFooter className="mt-6">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isFormSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isFormSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                {isFormSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                  </div>
                  </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Importar Colaboradores via CSV</DialogTitle>
                        <DialogDescription>
                            Faça o upload de um arquivo CSV para adicionar múltiplos colaboradores de uma só vez.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-md border border-amber-500/50 bg-amber-500/10 text-amber-700">
                           <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-600 flex-shrink-0"/>
                                <div>
                                    <p className="font-semibold">Atenção: A importação irá adicionar novos colaboradores, mas não irá atualizar ou remover os existentes.</p>
                                </div>
                           </div>
                        </div>

                        <h3 className="font-semibold">Instruções:</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                            <li>Crie uma planilha (no Excel, Google Sheets, etc.).</li>
                            <li>A primeira linha **deve** ser um cabeçalho com os seguintes nomes de coluna, exatamente como mostrado:
                                <code className="block bg-muted p-2 rounded-md my-2 text-xs">idVeneto,name,email,axis,area,position,segment,leader,city,photoURL,googleDriveLinks</code>
                            </li>
                            <li>Compatibilidade: `id3a` também é aceito temporariamente durante a migração.</li>
                             <li>As colunas `photoURL` e `googleDriveLinks` são opcionais. Para múltiplos links do Drive, separe-os por vírgula no campo.</li>
                            <li>Preencha as linhas com os dados de cada colaborador.</li>
                            <li>Exporte ou salve o arquivo no formato **CSV (Valores Separados por Vírgula)**.</li>
                            <li>Clique no botão abaixo para selecionar e enviar o arquivo.</li>
                        </ol>
                         <a href="/templates/modelo_colaboradores.csv" download className="inline-block" >
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
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".csv"
                            onChange={handleFileImport}
                        />
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

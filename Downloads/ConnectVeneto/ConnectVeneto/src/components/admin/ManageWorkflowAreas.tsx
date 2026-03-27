
"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Edit, Trash2, Loader2, ListOrdered } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { iconList, getIcon } from '@/lib/icons';
import { useWorkflowAreas, WorkflowArea, workflowAreaSchema } from '@/contexts/WorkflowAreasContext';
import { OrderWorkflowsModal } from './OrderWorkflowsModal';
import { useApplications } from '@/contexts/ApplicationsContext';
import { LoadingSpinner } from '../ui/loading-spinner';

type AreaFormValues = Omit<WorkflowArea, 'id'>;

export default function ManageWorkflowAreas() {
    const { workflowAreas, loading, addWorkflowArea, updateWorkflowArea, deleteWorkflowAreaMutation } = useWorkflowAreas();
    const { workflowDefinitions } = useApplications();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<WorkflowArea | null>(null);
    const [areaToOrder, setAreaToOrder] = useState<WorkflowArea | null>(null);

    const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AreaFormValues>({
        resolver: zodResolver(workflowAreaSchema),
        defaultValues: { name: '', icon: 'FolderOpen', storageFolderPath: '' },
    });

    const handleOpenForm = (area: WorkflowArea | null) => {
        setEditingArea(area);
        if (area) {
            reset(area);
        } else {
            reset({ name: '', icon: 'FolderOpen', storageFolderPath: '' });
        }
        setIsFormOpen(true);
    };

    const handleOpenOrderModal = (area: WorkflowArea) => {
        setAreaToOrder(area);
        setIsOrderModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir esta área? Os workflows associados precisarão ser reatribuídos.")) return;
        try {
            await deleteWorkflowAreaMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Área de workflow excluída." });
        } catch (error) {
            toast({ title: "Falha na Exclusão", description: (error as Error).message, variant: "destructive" });
        }
    };

    const onSubmit = async (data: AreaFormValues) => {
        try {
            if (editingArea) {
                await updateWorkflowArea({ ...data, id: editingArea.id });
                toast({ title: "Sucesso!", description: "Área de workflow atualizada." });
            } else {
                await addWorkflowArea(data);
                toast({ title: "Sucesso!", description: "Nova área de workflow criada." });
            }
            setIsFormOpen(false);
        } catch (error) {
            toast({ title: "Erro", description: (error as Error).message, variant: "destructive" });
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <CardTitle>Áreas de Workflow (Grupos)</CardTitle>
                        <CardDescription>Gerencie os grupos que organizam os workflows para os usuários.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenForm(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nova Área
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ícone</TableHead>
                                    <TableHead>Nome da Área</TableHead>
                                    <TableHead>Caminho no Storage</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-6">
                                            <div className="flex justify-center">
                                                <LoadingSpinner className="h-5 w-5" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : workflowAreas.map(area => {
                                    const Icon = getIcon(area.icon);
                                    return (
                                        <TableRow key={area.id}>
                                            <TableCell><Icon className="h-5 w-5 text-muted-foreground" /></TableCell>
                                            <TableCell className="font-medium">{area.name}</TableCell>
                                            <TableCell className="font-mono text-xs">{area.storageFolderPath || 'Padrão'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenOrderModal(area)} className="hover:bg-muted" title="Ordenar Workflows">
                                                    <ListOrdered className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenForm(area)} className="hover:bg-muted" title="Editar Área">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(area.id)} className="hover:bg-muted" disabled={deleteWorkflowAreaMutation.isPending && deleteWorkflowAreaMutation.variables === area.id} title="Excluir Área">
                                                    {deleteWorkflowAreaMutation.isPending && deleteWorkflowAreaMutation.variables === area.id ? (
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
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingArea ? 'Editar Área' : 'Nova Área'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="name">Nome da Área</Label>
                            <Input id="name" {...register('name')} />
                            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="icon">Ícone</Label>
                            <Controller name="icon" control={control} render={({ field }) => {
                                const IconToShow = getIcon(field.value);
                                return (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue>
                                                <div className="flex items-center gap-2"><IconToShow className='h-4 w-4' /><span>{field.value}</span></div>
                                            </SelectValue></SelectTrigger>
                                        <SelectContent><ScrollArea className="h-72">
                                            {iconList.map(iconName => {
                                                const Icon = getIcon(iconName);
                                                return <SelectItem key={iconName} value={iconName}><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span>{iconName}</span></div></SelectItem>
                                            })}
                                        </ScrollArea></SelectContent>
                                    </Select>
                                );
                            }}/>
                            {errors.icon && <p className="text-sm text-destructive mt-1">{errors.icon.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="storageFolderPath">Caminho da Pasta no Storage</Label>
                            <Input id="storageFolderPath" {...register('storageFolderPath')} placeholder="ex: financas/reembolsos" />
                            <p className="text-xs text-muted-foreground mt-1">Este campo é obrigatório e não pode ser uma pasta raiz.</p>
                            {errors.storageFolderPath && <p className="text-sm text-destructive mt-1">{errors.storageFolderPath.message}</p>}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {areaToOrder && (
                <OrderWorkflowsModal
                    isOpen={isOrderModalOpen}
                    onClose={() => setIsOrderModalOpen(false)}
                    area={areaToOrder}
                    allWorkflows={workflowDefinitions}
                />
            )}
        </>
    );
}

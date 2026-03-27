"use client";
import React, { useState } from 'react';
import { useLabs } from '@/contexts/LabsContext';
import type { LabType } from '@/contexts/LabsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';

const labSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Título é obrigatório"),
    subtitle: z.string().optional(),
    category: z.string().min(1, "Categoria é obrigatória"),
    videoUrl: z.string().url("URL do vídeo inválida"),
    lastModified: z.string().min(1, "Data é obrigatória"),
});

type LabFormValues = z.infer<typeof labSchema>;

export function ManageLabs() {
    const { labs, addLab, updateLab, deleteLabMutation } = useLabs();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<LabType | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting: isFormSubmitting } } = useForm<LabFormValues>({
        resolver: zodResolver(labSchema),
    });

    const handleDialogOpen = (lab: LabType | null) => {
        setEditingLab(lab);
        if (lab) {
            const formattedLab = {
              ...lab,
              lastModified: new Date(lab.lastModified).toISOString().split('T')[0],
            };
            reset(formattedLab);
        } else {
            reset({
                id: undefined,
                title: '',
                subtitle: '',
                category: '',
                videoUrl: '',
                lastModified: new Date().toISOString().split('T')[0],
            });
        }
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este vídeo do Lab?")) return;

        const { update } = toast({
            title: "Diagnóstico de Exclusão",
            description: "1. Iniciando exclusão...",
            variant: "default",
        });

        try {
            update({ description: "2. Acionando a função de exclusão..." });
            await deleteLabMutation.mutateAsync(id);

            update({
                title: "Sucesso!",
                description: "3. Exclusão concluída. Atualizando a lista.",
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
            update({
                title: "Falha na Exclusão",
                description: `3. Erro: ${errorMessage}`,
                variant: "destructive",
            });
            console.error("Falha detalhada ao excluir:", error);
        }
    };
    
    const onSubmit = async (data: LabFormValues) => {
        try {
            if (editingLab) {
                await updateLab({ ...data, id: editingLab.id } as LabType);
                toast({ title: "Vídeo do Lab atualizado com sucesso." });
            } else {
                const { id: _id, ...dataWithoutId } = data;
                await addLab(dataWithoutId);
                toast({ title: "Vídeo do Lab adicionado com sucesso." });
            }
            setIsDialogOpen(false);
            setEditingLab(null);
        } catch (error) {
             toast({
                title: "Erro ao salvar",
                description: error instanceof Error ? error.message : "Não foi possível salvar o vídeo.",
                variant: "destructive"
            });
        }
    };
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gerenciar Labs</CardTitle>
                    <CardDescription>Adicione, edite ou remova vídeos e materiais do Labs.</CardDescription>
                </div>
                <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Vídeo
                </Button>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Modificado em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {labs.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.title}</TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell>{new Date(item.lastModified).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="hover:bg-muted" disabled={deleteLabMutation.isPending && deleteLabMutation.variables === item.id}>
                                             {deleteLabMutation.isPending && deleteLabMutation.variables === item.id ? (
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
            </CardContent>

             <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingLab(null); setIsDialogOpen(isOpen); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLab ? 'Editar Vídeo' : 'Adicionar Vídeo'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="title">Título do Vídeo</Label>
                            <Input id="title" {...register('title')} disabled={isFormSubmitting}/>
                            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
                            <Input id="subtitle" {...register('subtitle')} disabled={isFormSubmitting}/>
                        </div>
                        <div>
                            <Label htmlFor="category">Categoria</Label>
                            <Input id="category" {...register('category')} disabled={isFormSubmitting}/>
                            {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="lastModified">Data de Modificação</Label>
                            <Input id="lastModified" type="date" {...register('lastModified')} disabled={isFormSubmitting}/>
                            {errors.lastModified && <p className="text-sm text-destructive mt-1">{errors.lastModified.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="videoUrl">URL do Vídeo</Label>
                            <Input id="videoUrl" {...register('videoUrl')} placeholder="https://..." disabled={isFormSubmitting}/>
                            {errors.videoUrl && <p className="text-sm text-destructive mt-1">{errors.videoUrl.message}</p>}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isFormSubmitting}>Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isFormSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                {isFormSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

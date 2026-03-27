
"use client";
import React, { useState, useMemo } from 'react';
import { useRankings, type RankingType, rankingSchema } from '@/contexts/RankingsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { RecipientSelectionModal } from './RecipientSelectionModal';
import { Badge } from '../ui/badge';

const formSchema = rankingSchema;
type RankingFormValues = z.infer<typeof formSchema>;

export function ManageRankings() {
    const { rankings, addRanking, updateRanking, deleteRankingMutation } = useRankings();
    const { collaborators } = useCollaborators();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [editingRanking, setEditingRanking] = useState<RankingType | null>(null);

    const form = useForm<RankingFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: '', order: 0, recipientIds: ['all'], pdfUrl: '' }
    });
    
    const { formState: { isSubmitting } } = form;
    const watchRecipientIds = form.watch('recipientIds');

    const collaboratorsWithAccess = useMemo(() => {
        return collaborators.filter(c => c.permissions?.canViewRankings);
    }, [collaborators]);

    const handleDialogOpen = (ranking: RankingType | null) => {
        setEditingRanking(ranking);
        if (ranking) {
            form.reset(ranking);
        } else {
            form.reset({
                name: '',
                order: rankings.length > 0 ? Math.max(...rankings.map(r => r.order)) + 1 : 0,
                recipientIds: ['all'],
                pdfUrl: '',
            });
        }
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja remover este documento?")) return;
        try {
            await deleteRankingMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Documento de ranking removido." });
        } catch (error) {
            toast({ title: "Falha na Exclusão", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: RankingFormValues) => {
        try {
            if (editingRanking) {
                await updateRanking({ ...data, id: editingRanking.id });
                toast({ title: "Ranking atualizado com sucesso." });
            } else {
                await addRanking(data);
                toast({ title: "Ranking adicionado com sucesso." });
            }
            setIsDialogOpen(false);
        } catch (error) {
            toast({ title: "Erro ao salvar", description: error instanceof Error ? error.message : "Não foi possível salvar o documento.", variant: "destructive" });
        }
    };
    
    const getRecipientDescription = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Nenhum destinatário';
        if (ids.includes('all')) return 'Todos os Colaboradores com Acesso';
        if (ids.length === 1) return '1 colaborador selecionado';
        return `${ids.length} colaboradores selecionados`;
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Gerenciar Rankings e Campanhas</CardTitle>
                        <CardDescription>Adicione e organize os PDFs que aparecerão na página de Rankings.</CardDescription>
                    </div>
                    <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar PDF
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ordem</TableHead>
                                    <TableHead>Nome da Aba</TableHead>
                                    <TableHead>Visibilidade</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rankings.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.order}</TableCell>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{getRecipientDescription(item.recipientIds)}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={deleteRankingMutation.isPending && deleteRankingMutation.variables === item.id} className="hover:bg-muted">
                                                {deleteRankingMutation.isPending && deleteRankingMutation.variables === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRanking ? 'Editar Documento' : 'Adicionar Documento'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="name">Nome da Aba</Label>
                            <Input id="name" {...form.register('name')} disabled={isSubmitting} />
                            {form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="pdfUrl">URL Pública do Arquivo PDF</Label>
                            <Input id="pdfUrl" {...form.register('pdfUrl')} placeholder="https://..." disabled={isSubmitting}/>
                            {form.formState.errors.pdfUrl && <p className="text-sm text-destructive mt-1">{form.formState.errors.pdfUrl.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="order">Ordem de Exibição</Label>
                            <Input id="order" type="number" {...form.register('order', { valueAsNumber: true })} disabled={isSubmitting} />
                            {form.formState.errors.order && <p className="text-sm text-destructive mt-1">{form.formState.errors.order.message}</p>}
                        </div>
                        <div>
                            <Label>Visibilidade (Quem pode ver este documento?)</Label>
                            <Button type="button" variant="outline" className="w-full justify-start text-left mt-2" onClick={() => setIsSelectionModalOpen(true)}>
                               <Users className="mr-2 h-4 w-4" />
                               <span>{getRecipientDescription(watchRecipientIds)}</span>
                            </Button>
                             {form.formState.errors.recipientIds && <p className="text-sm text-destructive mt-1">{form.formState.errors.recipientIds.message as string}</p>}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" className="bg-admin-primary hover:bg-admin-primary/90" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

             <RecipientSelectionModal
                isOpen={isSelectionModalOpen}
                onClose={() => setIsSelectionModalOpen(false)}
                allCollaborators={collaboratorsWithAccess}
                selectedIds={watchRecipientIds}
                onConfirm={(newIds) => {
                    form.setValue('recipientIds', newIds, { shouldValidate: true });
                    setIsSelectionModalOpen(false);
                }}
            />
        </>
    );
}

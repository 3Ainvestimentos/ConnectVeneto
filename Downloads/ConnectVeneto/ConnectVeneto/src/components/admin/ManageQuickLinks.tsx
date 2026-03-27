
"use client";
import React, { useState } from 'react';
import { useQuickLinks, type QuickLinkType, quickLinkSchema } from '@/contexts/QuickLinksContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { RecipientSelectionModal } from './RecipientSelectionModal';
import { Switch } from '../ui/switch';
import Image from 'next/image';

const formSchema = quickLinkSchema;
type QuickLinkFormValues = z.infer<typeof formSchema>;

export function ManageQuickLinks() {
    const { quickLinks, addQuickLink, updateQuickLink, deleteQuickLinkMutation } = useQuickLinks();
    const { collaborators } = useCollaborators();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<QuickLinkType | null>(null);

    const form = useForm<QuickLinkFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            link: '',
            isUserSpecific: false,
            recipientIds: ['all'],
            order: 0,
            imageUrl: '',
        }
    });

    const { formState: { isSubmitting } } = form;
    const watchRecipientIds = form.watch('recipientIds');
    const watchIsUserSpecific = form.watch('isUserSpecific');

    const handleDialogOpen = (link: QuickLinkType | null) => {
        setEditingLink(link);
        if (link) {
            form.reset(link);
        } else {
            form.reset({
                name: '',
                link: '',
                isUserSpecific: false,
                recipientIds: ['all'],
                order: quickLinks.length > 0 ? Math.max(...quickLinks.map(l => l.order)) + 1 : 0,
                imageUrl: '',
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este link rápido?")) return;
        try {
            await deleteQuickLinkMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Link rápido excluído." });
        } catch (error) {
            toast({ title: "Falha na Exclusão", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const handleOrderChange = async (linkId: string, newOrder: number) => {
        const linkToUpdate = quickLinks.find(link => link.id === linkId);
        if (linkToUpdate) {
            try {
                await updateQuickLink({ ...linkToUpdate, order: newOrder });
                toast({ title: "Ordem atualizada", description: `A ordem do link "${linkToUpdate.name}" foi salva.` });
            } catch (error) {
                 toast({ title: "Erro ao atualizar ordem", description: (error as Error).message, variant: "destructive" });
            }
        }
    };
    
    const onSubmit = async (data: QuickLinkFormValues) => {
        try {
            if (editingLink) {
                await updateQuickLink({ ...data, id: editingLink.id });
                toast({ title: "Link Rápido atualizado com sucesso." });
            } else {
                await addQuickLink(data);
                toast({ title: "Link Rápido adicionado com sucesso." });
            }
            setIsFormOpen(false);
            setEditingLink(null);
        } catch (error) {
            toast({ 
                title: "Erro ao salvar", 
                description: error instanceof Error ? error.message : "Não foi possível salvar o link.",
                variant: "destructive" 
            });
        }
    };

    const getRecipientDescription = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Nenhum destinatário';
        if (ids.includes('all')) return 'Todos os Colaboradores';
        return `${ids.length} colaborador(es) selecionado(s)`;
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gerenciar Links Rápidos</CardTitle>
                    <CardDescription>Adicione, edite e ordene os links da página inicial.</CardDescription>
                </div>
                <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Link
                </Button>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Ordem</TableHead>
                                <TableHead>Imagem</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Destinatários</TableHead>
                                <TableHead>Dinâmico</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quickLinks.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Input
                                          type="number"
                                          defaultValue={item.order}
                                          onBlur={(e) => handleOrderChange(item.id, parseInt(e.target.value, 10) || 0)}
                                          className="w-20"
                                          aria-label={`Ordem do link ${item.name}`}
                                        />
                                    </TableCell>
                                    <TableCell>
                                      <Image src={item.imageUrl} alt={item.name || ''} width={40} height={40} className="rounded-md object-contain" />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {item.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {getRecipientDescription(item.recipientIds)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {item.isUserSpecific ? 'Sim' : 'Não'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="hover:bg-muted" disabled={deleteQuickLinkMutation.isPending && deleteQuickLinkMutation.variables === item.id}>
                                            {deleteQuickLinkMutation.isPending && deleteQuickLinkMutation.variables === item.id ? (
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

             <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingLink(null); setIsFormOpen(isOpen); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLink ? 'Editar Link Rápido' : 'Adicionar Link Rápido'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="name">Nome do Link (Opcional)</Label>
                            <Input id="name" {...form.register('name')} disabled={isSubmitting}/>
                            {form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}
                        </div>

                        <div>
                            <Label htmlFor="imageUrl">URL da Imagem</Label>
                            <Input id="imageUrl" {...form.register('imageUrl')} placeholder="Cole a URL pública da imagem aqui..." disabled={isSubmitting}/>
                            {form.formState.errors.imageUrl && <p className="text-sm text-destructive mt-1">{form.formState.errors.imageUrl.message}</p>}
                        </div>

                        <div>
                            <Label htmlFor="link">URL do Link de Destino</Label>
                            <Input id="link" {...form.register('link')} disabled={isSubmitting}/>
                            {form.formState.errors.link && <p className="text-sm text-destructive mt-1">{form.formState.errors.link.message}</p>}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <Switch id="isUserSpecific" checked={watchIsUserSpecific} onCheckedChange={(checked) => form.setValue('isUserSpecific', checked)} className="data-[state=checked]:bg-[hsl(170,60%,50%)]" />
                            <Label htmlFor="isUserSpecific">Link dinâmico por usuário</Label>
                        </div>

                        {watchIsUserSpecific && (
                             <div className="p-3 rounded-md border border-amber-500/50 bg-amber-500/10 text-amber-700">
                                <div className="flex items-start gap-3">
                                     <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-600 flex-shrink-0"/>
                                     <div>
                                         <p className="text-sm">Use a variável <code className="font-mono bg-amber-200 text-amber-900 px-1 py-0.5 rounded">{"{userEmail}"}</code> na URL para que ela seja substituída pelo email do usuário logado.</p>
                                         <p className="text-xs mt-1">Exemplo: <code className="font-mono">https://drive.google.com/drive/u/0/folders/{"{userEmail}"}</code></p>
                                     </div>
                                </div>
                             </div>
                        )}
                        

                        <Separator />
                        <div>
                            <Label>Visibilidade (Quem pode ver este link?)</Label>
                             <Button type="button" variant="outline" className="w-full justify-start text-left mt-2" onClick={() => setIsSelectionModalOpen(true)}>
                               <Users className="mr-2 h-4 w-4" />
                               <span>{getRecipientDescription(watchRecipientIds)}</span>
                            </Button>
                            {form.formState.errors.recipientIds && <p className="text-sm text-destructive mt-1">{form.formState.errors.recipientIds.message as string}</p>}
                        </div>
                        
                        <DialogFooter className="mt-6">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
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
                allCollaborators={collaborators}
                selectedIds={watchRecipientIds}
                onConfirm={(newIds) => {
                    form.setValue('recipientIds', newIds, { shouldValidate: true });
                    setIsSelectionModalOpen(false);
                }}
            />
        </Card>
    );
}

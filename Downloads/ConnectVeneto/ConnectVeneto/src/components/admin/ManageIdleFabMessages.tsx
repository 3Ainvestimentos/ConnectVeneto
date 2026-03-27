
"use client";

import React, { useState } from 'react';
import { useIdleFabMessages, idleFabMessageSchema, IdleFabMessageType } from '@/contexts/IdleFabMessagesContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { LoadingSpinner } from '../ui/loading-spinner';

type MessageFormValues = z.infer<typeof idleFabMessageSchema>;

export function ManageIdleFabMessages() {
    const { idleMessages, addIdleMessage, updateIdleMessage, deleteIdleMessage, loading } = useIdleFabMessages();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<IdleFabMessageType | null>(null);

    const form = useForm<MessageFormValues>({
        resolver: zodResolver(idleFabMessageSchema),
    });

    const handleDialogOpen = (message: IdleFabMessageType | null) => {
        setEditingMessage(message);
        if (message) {
            form.reset(message);
        } else {
            form.reset({
                text: '',
                order: idleMessages.length > 0 ? Math.max(...idleMessages.map(m => m.order)) + 1 : 0,
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir esta mensagem?")) return;
        try {
            await deleteIdleMessage(id);
            toast({ title: "Sucesso!", description: "Mensagem ociosa removida." });
        } catch (error) {
            toast({ title: "Falha na Exclusão", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: MessageFormValues) => {
        try {
            if (editingMessage) {
                await updateIdleMessage({ ...data, id: editingMessage.id });
                toast({ title: "Mensagem atualizada com sucesso." });
            } else {
                await addIdleMessage(data);
                toast({ title: "Nova mensagem adicionada com sucesso." });
            }
            setIsFormOpen(false);
        } catch (error) {
            toast({ title: "Erro ao salvar", description: (error as Error).message, variant: "destructive" });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gerenciar Mensagens Ociosas do FAB</CardTitle>
                    <CardDescription>Configure as mensagens exibidas em carrossel quando não há campanhas ativas.</CardDescription>
                </div>
                <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Mensagem
                </Button>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ordem</TableHead>
                                <TableHead>Texto</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {idleMessages.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.order}</TableCell>
                                    <TableCell className="font-medium max-w-lg truncate">{item.text}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="hover:bg-muted">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {loading && (
                    <div className="mt-4 flex justify-center">
                        <LoadingSpinner className="h-5 w-5" />
                    </div>
                )}
                {!loading && idleMessages.length === 0 && <p className="text-center mt-4 text-muted-foreground">Nenhuma mensagem ociosa configurada.</p>}
            </CardContent>

             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingMessage ? 'Editar Mensagem' : 'Nova Mensagem Ociosa'}</DialogTitle>
                        <DialogDescription>
                            Esta mensagem aparecerá no carrossel quando o usuário clicar no FAB sem uma campanha ativa.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="text">Texto da Mensagem</Label>
                            <Textarea id="text" {...form.register('text')} rows={4} />
                            {form.formState.errors.text && <p className="text-sm text-destructive mt-1">{form.formState.errors.text.message}</p>}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" disabled={form.formState.isSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

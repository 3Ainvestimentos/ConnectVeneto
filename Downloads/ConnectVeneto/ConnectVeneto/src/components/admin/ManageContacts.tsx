"use client";

import React, { useState } from 'react';
import { useContacts, type ContactType, contactSchema } from '@/contexts/ContactsContext';
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

type ContactFormValues = z.infer<typeof contactSchema>;

export function ManageContacts() {
    const { contacts, addContact, updateContact, deleteContactMutation } = useContacts();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<ContactType | null>(null);

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: { area: '', manager: '', slackUrl: '', order: 0 }
    });

    const { formState: { isSubmitting } } = form;

    const handleDialogOpen = (contact: ContactType | null) => {
        setEditingContact(contact);
        if (contact) {
            form.reset(contact);
        } else {
            form.reset({
                area: '',
                manager: '',
                slackUrl: '',
                order: contacts.length > 0 ? Math.max(...contacts.map(c => c.order)) + 1 : 0,
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este contato?")) return;
        try {
            await deleteContactMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Contato excluído." });
        } catch (error) {
            toast({ title: "Falha na Exclusão", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: ContactFormValues) => {
        try {
            if (editingContact) {
                await updateContact({ ...data, id: editingContact.id });
                toast({ title: "Contato atualizado com sucesso." });
            } else {
                await addContact(data);
                toast({ title: "Contato adicionado com sucesso." });
            }
            setIsFormOpen(false);
        } catch (error) {
            toast({ 
                title: "Erro ao salvar", 
                description: error instanceof Error ? error.message : "Não foi possível salvar o contato.",
                variant: "destructive" 
            });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gerenciar Contatos</CardTitle>
                    <CardDescription>Adicione, edite ou remova os contatos exibidos no painel inicial.</CardDescription>
                </div>
                <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Contato
                </Button>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ordem</TableHead>
                                <TableHead>Área</TableHead>
                                <TableHead>Gestor</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contacts.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.order}</TableCell>
                                    <TableCell className="font-medium">{item.area}</TableCell>
                                    <TableCell>{item.manager}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={deleteContactMutation.isPending && deleteContactMutation.variables === item.id} className="hover:bg-muted">
                                            {deleteContactMutation.isPending && deleteContactMutation.variables === item.id ? (
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

             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingContact ? 'Editar Contato' : 'Adicionar Contato'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="area">Área</Label>
                            <Input id="area" {...form.register('area')} disabled={isSubmitting}/>
                            {form.formState.errors.area && <p className="text-sm text-destructive mt-1">{form.formState.errors.area.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="manager">Gestor</Label>
                            <Input id="manager" {...form.register('manager')} disabled={isSubmitting}/>
                            {form.formState.errors.manager && <p className="text-sm text-destructive mt-1">{form.formState.errors.manager.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="slackUrl">Link do contato</Label>
                            <Input id="slackUrl" {...form.register('slackUrl')} placeholder="https://" disabled={isSubmitting}/>
                            {form.formState.errors.slackUrl && <p className="text-sm text-destructive mt-1">{form.formState.errors.slackUrl.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="order">Ordem</Label>
                            <Input id="order" type="number" {...form.register('order', { valueAsNumber: true })} disabled={isSubmitting} />
                            {form.formState.errors.order && <p className="text-sm text-destructive mt-1">{form.formState.errors.order.message}</p>}
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
        </Card>
    );
}

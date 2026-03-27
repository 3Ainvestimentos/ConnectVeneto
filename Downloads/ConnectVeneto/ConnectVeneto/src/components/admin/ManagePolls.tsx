
"use client";
import React, { useState } from 'react';
import { usePolls, type PollType, pollSchema } from '@/contexts/PollsContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Users, BarChart, X, Route, MessageSquare, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { RecipientSelectionModal } from './RecipientSelectionModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import Link from 'next/link';
import { navItems } from '@/components/layout/navigation';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

type PollFormValues = z.infer<typeof pollSchema>;

const pageOptions = navItems
    .filter(item => !item.external && item.href !== '/chatbot' && item.href !== '/store')
    .map(item => ({ label: item.label, value: item.href }));

export function ManagePolls() {
    const { polls, addPoll, updatePoll, deletePollMutation } = usePolls();
    const { collaborators } = useCollaborators();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [editingPoll, setEditingPoll] = useState<PollType | null>(null);

    const form = useForm<PollFormValues>({
        resolver: zodResolver(pollSchema),
        defaultValues: {
            question: '',
            type: 'multiple-choice',
            options: [{ value: '' }, { value: '' }],
            allowOtherOption: false,
            targetPage: '/dashboard',
            recipientIds: ['all'],
            isActive: true,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "options",
    });

    const watchRecipientIds = form.watch('recipientIds');
    const watchPollType = form.watch('type');

    const handleDialogOpen = (poll: PollType | null) => {
        setEditingPoll(poll);
        if (poll) {
            form.reset({
                ...poll,
                type: poll.type || 'multiple-choice',
                options: poll.options?.map(opt => ({ value: opt })),
                allowOtherOption: poll.allowOtherOption || false,
            });
        } else {
            form.reset({
                question: '',
                type: 'multiple-choice',
                options: [{ value: 'Sim' }, { value: 'Não' }],
                allowOtherOption: false,
                targetPage: '/dashboard',
                recipientIds: ['all'],
                isActive: true,
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir esta pesquisa? Todas as respostas associadas serão perdidas.")) return;
        try {
            await deletePollMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Pesquisa excluída." });
        } catch (error) {
            toast({ title: "Falha na Exclusão", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: PollFormValues) => {
        const pollData = {
            ...data,
            options: data.type === 'multiple-choice' ? (data.options || []).map(opt => opt.value) : [],
            allowOtherOption: data.type === 'multiple-choice' ? data.allowOtherOption : false,
        };
        try {
            if (editingPoll) {
                await updatePoll({ ...pollData, id: editingPoll.id });
                toast({ title: "Pesquisa atualizada com sucesso." });
            } else {
                await addPoll(pollData);
                toast({ title: "Pesquisa criada com sucesso." });
            }
            setIsFormOpen(false);
        } catch (error) {
            toast({ title: "Erro ao salvar", description: (error as Error).message, variant: "destructive" });
        }
    };

    const getRecipientDescription = (ids: string[] | undefined) => {
        if (!ids || ids.length === 0) return 'Nenhum destinatário';
        if (ids.includes('all')) return 'Todos os Colaboradores';
        return `${ids.length} colaborador(es)`;
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gerenciar Pesquisas Rápidas</CardTitle>
                    <CardDescription>Crie pesquisas para aparecerem em páginas específicas para os colaboradores.</CardDescription>
                </div>
                <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Pesquisa
                </Button>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pergunta</TableHead>
                                <TableHead>Página Alvo</TableHead>
                                <TableHead>Público</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {polls.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium max-w-xs truncate">{item.question}</TableCell>
                                    <TableCell><Badge variant="outline" className="flex items-center gap-1.5 w-fit"><Route className="h-3 w-3"/>{item.targetPage}</Badge></TableCell>
                                    <TableCell><Badge variant="outline">{getRecipientDescription(item.recipientIds)}</Badge></TableCell>
                                    <TableCell>
                                        <Badge variant={item.isActive ? 'default' : 'secondary'} className={item.isActive ? 'bg-success' : ''}>
                                            {item.isActive ? 'Ativa' : 'Inativa'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" asChild className="hover:bg-muted">
                                            <Link href={`/admin/polls/${item.id}/results`}><BarChart className="h-4 w-4" /></Link>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={deletePollMutation.isPending && deletePollMutation.variables === item.id} className="hover:bg-muted">
                                            {deletePollMutation.isPending && deletePollMutation.variables === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={isFormOpen} onOpenChange={(isOpen) => !isOpen && setIsFormOpen(false)}>
                <DialogContent className="max-w-xl">
                    <ScrollArea className="max-h-[80vh] p-6 pt-0">
                        <DialogHeader>
                            <DialogTitle>{editingPoll ? 'Editar Pesquisa' : 'Nova Pesquisa'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                            <div className="flex items-center space-x-2">
                                <Controller name="isActive" control={form.control} render={({ field }) => (
                                    <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                                )}/>
                                <Label htmlFor="isActive">Pesquisa Ativa</Label>
                            </div>
                            <div>
                                <Label htmlFor="question">Pergunta</Label>
                                <Input id="question" {...form.register('question')} />
                                {form.formState.errors.question && <p className="text-sm text-destructive mt-1">{form.formState.errors.question.message}</p>}
                            </div>

                             <div>
                                <Label>Tipo de Resposta</Label>
                                <Controller name="type" control={form.control} render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="multiple-choice" id="multiple-choice" /><Label htmlFor="multiple-choice" className="flex items-center gap-2"><CheckSquare className="h-4 w-4"/>Múltipla Escolha</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="open-text" id="open-text" /><Label htmlFor="open-text" className="flex items-center gap-2"><MessageSquare className="h-4 w-4"/>Texto Aberto</Label></div>
                                    </RadioGroup>
                                )}/>
                            </div>

                            {watchPollType === 'multiple-choice' && (
                                <div className="p-3 border rounded-md space-y-4">
                                    <Label>Opções de Resposta</Label>
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex items-center gap-2 mt-1">
                                            <Input {...form.register(`options.${index}.value`)} />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })} className="mt-2">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Opção
                                    </Button>
                                    {form.formState.errors.options && <p className="text-sm text-destructive mt-1">{form.formState.errors.options.message}</p>}
                                    <Separator/>
                                     <div className="flex items-center space-x-2">
                                        <Controller name="allowOtherOption" control={form.control} render={({ field }) => (
                                            <Switch id="allowOtherOption" checked={field.value} onCheckedChange={field.onChange} />
                                        )}/>
                                        <Label htmlFor="allowOtherOption">Permitir opção &quot;Outros&quot;?</Label>
                                    </div>
                                </div>
                            )}

                            <Separator />
                            
                            <div>
                                <Label htmlFor="targetPage">Página de Exibição</Label>
                                <Controller name="targetPage" control={form.control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            {pageOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )} />
                                {form.formState.errors.targetPage && <p className="text-sm text-destructive mt-1">{form.formState.errors.targetPage.message}</p>}
                            </div>
                             <div>
                                <Label>Público-Alvo</Label>
                                <Button type="button" variant="outline" className="w-full justify-start text-left mt-2" onClick={() => setIsSelectionModalOpen(true)}>
                                   <Users className="mr-2 h-4 w-4" />
                                   <span>{getRecipientDescription(watchRecipientIds)}</span>
                                </Button>
                                {form.formState.errors.recipientIds && <p className="text-sm text-destructive mt-1">{form.formState.errors.recipientIds.message as string}</p>}
                            </div>
                            <DialogFooter className="pt-4">
                                <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                                <Button type="submit" className="bg-admin-primary hover:bg-admin-primary/90">
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </form>
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
        </Card>
    );
}

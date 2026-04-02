
"use client";
import React, { useState } from 'react';
import { useDocuments } from '@/contexts/DocumentsContext';
import type { DocumentType } from '@/contexts/DocumentsContext';
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

const documentSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Nome é obrigatório"),
    category: z.string().min(1, "Categoria é obrigatória"),
    type: z.string().min(1, "Tipo é obrigatório"),
    size: z.string().min(1, "Tamanho é obrigatório."),
    downloadUrl: z
        .string()
        .url("URL para download é obrigatória e deve ser um link válido.")
        .refine(
          (u) => {
            try {
              return new URL(u).protocol === "https:";
            } catch {
              return false;
            }
          },
          { message: "O link deve usar HTTPS (requisito das regras de segurança do Firestore)." }
        ),
    dataAiHint: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

export function ManageDocuments() {
    const { documents, addDocument, updateDocument, deleteDocumentMutation } = useDocuments();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState<DocumentType | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DocumentFormValues>({
        resolver: zodResolver(documentSchema),
    });

    const handleDialogOpen = (doc: DocumentType | null) => {
        setEditingDocument(doc);
        if (doc) {
            reset(doc);
        } else {
            reset({
                id: undefined,
                name: '',
                category: '',
                type: '',
                size: '',
                downloadUrl: '',
                dataAiHint: '',
            });
        }
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este documento?")) return;
        
        try {
            await deleteDocumentMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Documento excluído." });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
            toast({ title: "Falha na Exclusão", description: errorMessage, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: DocumentFormValues) => {
        try {
            const submissionData = { ...data, lastModified: new Date().toISOString() };

            if (editingDocument) {
                await updateDocument({ ...submissionData, id: editingDocument.id } as DocumentType);
                toast({ title: "Documento atualizado com sucesso." });
            } else {
                await addDocument(submissionData as Omit<DocumentType, 'id'>);
                toast({ title: "Documento adicionado com sucesso." });
            }
            setIsDialogOpen(false);
        } catch (error) {
             toast({
                title: "Erro ao salvar",
                description: error instanceof Error ? error.message : "Não foi possível salvar o documento.",
                variant: "destructive"
            });
        }
    };
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gerenciar Documentos</CardTitle>
                    <CardDescription>Adicione, edite ou remova documentos do repositório.</CardDescription>
                </div>
                <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Documento
                </Button>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Modificado em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {documents.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell>{new Date(item.lastModified).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="hover:bg-muted" disabled={deleteDocumentMutation.isPending && deleteDocumentMutation.variables === item.id}>
                                            {deleteDocumentMutation.isPending && deleteDocumentMutation.variables === item.id ? (
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

             <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingDocument(null); setIsDialogOpen(isOpen); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDocument ? 'Editar Documento' : 'Adicionar Documento'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="name">Nome do Arquivo</Label>
                            <Input id="name" {...register('name')} disabled={isSubmitting}/>
                            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="category">Categoria</Label>
                            <Input id="category" {...register('category')} disabled={isSubmitting}/>
                            {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="type">Tipo (ex: pdf, docx)</Label>
                            <Input id="type" {...register('type')} disabled={isSubmitting}/>
                            {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="size">Tamanho (ex: 2.5 MB)</Label>
                            <Input id="size" {...register('size')} disabled={isSubmitting}/>
                            {errors.size && <p className="text-sm text-destructive mt-1">{errors.size.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="downloadUrl">URL Pública do Arquivo</Label>
                            <Input id="downloadUrl" {...register('downloadUrl')} placeholder="https://..." disabled={isSubmitting}/>
                            {errors.downloadUrl && <p className="text-sm text-destructive mt-1">{errors.downloadUrl.message}</p>}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                            </DialogClose>
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

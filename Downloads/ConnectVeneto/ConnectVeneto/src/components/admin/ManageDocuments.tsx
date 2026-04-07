
"use client";
import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { venetoRepositoryDocuments } from '@/config/veneto-documentos';
import { mergeStaticAndFirestoreDocuments, isAllowedDocumentInternalPath, formatRepositoryLastModifiedForDisplay } from '@/lib/document-repository-utils';
import { setDocumentInCollection } from '@/lib/firestore-service';
import { useAuth } from '@/contexts/AuthContext';

const documentSchema = z
    .object({
        id: z.string().optional(),
        name: z.string().min(1, "Nome é obrigatório"),
        category: z.string().min(1, "Categoria é obrigatória"),
        type: z.string().min(1, "Tipo é obrigatório"),
        size: z.string().min(1, "Tamanho é obrigatório."),
        downloadUrl: z.string(),
        internalPath: z.string().optional(),
        dataAiHint: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.type === "interno") {
            if (data.downloadUrl.trim() !== "") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Documentos internos usam rota interna; deixe o URL vazio.",
                    path: ["downloadUrl"],
                });
            }
            if (!data.internalPath || !isAllowedDocumentInternalPath(data.internalPath)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Rota interna inválida (somente páginas permitidas pelo repositório).",
                    path: ["internalPath"],
                });
            }
        } else {
            if (data.internalPath != null && data.internalPath.trim() !== "") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Remova a rota interna quando usar link HTTPS.",
                    path: ["internalPath"],
                });
            }
            try {
                const u = new URL(data.downloadUrl);
                if (u.protocol !== "https:") {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "O link deve usar HTTPS (requisito das regras de segurança do Firestore).",
                        path: ["downloadUrl"],
                    });
                }
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "URL para download inválida.",
                    path: ["downloadUrl"],
                });
            }
        }
    });

type DocumentFormValues = z.infer<typeof documentSchema>;

const DOCUMENTS_QUERY_KEY = ['documents'] as const;

export function ManageDocuments() {
    const queryClient = useQueryClient();
    const { isSuperAdmin } = useAuth();
    const { documents, addDocument, updateDocument, deleteDocumentMutation } = useDocuments();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState<DocumentType | null>(null);

    const mergedDocuments = useMemo(() => {
        const merged = mergeStaticAndFirestoreDocuments(documents, venetoRepositoryDocuments);
        return [...merged].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [documents]);

    const persistedIds = useMemo(() => new Set(documents.map((d) => d.id)), [documents]);

    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<DocumentFormValues>({
        resolver: zodResolver(documentSchema),
    });

    const docType = watch("type");

    const handleDialogOpen = (doc: DocumentType | null) => {
        setEditingDocument(doc);
        if (doc) {
            reset({
                ...doc,
                internalPath: doc.internalPath ?? "",
                downloadUrl: doc.downloadUrl ?? "",
            });
        } else {
            reset({
                id: undefined,
                name: '',
                category: '',
                type: '',
                size: '',
                downloadUrl: '',
                internalPath: '',
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
            const lastModified = new Date().toISOString();
            const basePayload: Omit<DocumentType, "id"> = {
                name: data.name,
                category: data.category,
                type: data.type,
                size: data.size,
                lastModified,
                downloadUrl: data.type === "interno" ? "" : data.downloadUrl,
                ...(data.dataAiHint ? { dataAiHint: data.dataAiHint } : {}),
                ...(data.type === "interno" && data.internalPath
                    ? { internalPath: data.internalPath }
                    : {}),
            };

            if (editingDocument) {
                const inFirestore = persistedIds.has(editingDocument.id);
                if (inFirestore) {
                    await updateDocument({ ...basePayload, id: editingDocument.id } as DocumentType);
                } else {
                    await setDocumentInCollection("documents", editingDocument.id, basePayload);
                    await queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
                }
                toast({ title: "Documento atualizado com sucesso." });
            } else {
                await addDocument(basePayload);
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
                    <CardDescription>
                        Adicione, edite ou remova entradas do repositório (mesma lista vista na área de documentos).
                    </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                        onClick={() => handleDialogOpen(null)}
                        disabled={!isSuperAdmin}
                        title={!isSuperAdmin ? "Requer super administrador" : undefined}
                        className="bg-admin-primary hover:bg-admin-primary/90"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Documento
                    </Button>
                </div>
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
                            {mergedDocuments.map(item => {
                                const isInFirestore = persistedIds.has(item.id);
                                return (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell>{formatRepositoryLastModifiedForDisplay(item.lastModified)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDialogOpen(item)}
                                            disabled={!isSuperAdmin}
                                            className="hover:bg-muted"
                                            title={!isSuperAdmin ? "Requer super administrador" : "Editar"}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(item.id)}
                                            className="hover:bg-muted"
                                            disabled={
                                                !isSuperAdmin ||
                                                !isInFirestore ||
                                                (deleteDocumentMutation.isPending && deleteDocumentMutation.variables === item.id)
                                            }
                                            title={
                                                !isSuperAdmin
                                                    ? "Requer super administrador"
                                                    : isInFirestore
                                                      ? "Excluir"
                                                      : "Definido no código — edite src/config/veneto-documentos.ts para remover"
                                            }
                                        >
                                            {deleteDocumentMutation.isPending && deleteDocumentMutation.variables === item.id ? (
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
                        {docType === "interno" ? (
                            <div>
                                <Label htmlFor="internalPath">Rota interna</Label>
                                <Input id="internalPath" {...register('internalPath')} placeholder="/documents/glossario" disabled={isSubmitting}/>
                                {errors.internalPath && <p className="text-sm text-destructive mt-1">{errors.internalPath.message}</p>}
                            </div>
                        ) : null}
                         <div>
                            <Label htmlFor="downloadUrl">{docType === "interno" ? "URL (deixe vazio para interno)" : "URL Pública do Arquivo"}</Label>
                            <Input id="downloadUrl" {...register('downloadUrl')} placeholder={docType === "interno" ? "" : "https://..."} disabled={isSubmitting}/>
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

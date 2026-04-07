
"use client";
import React, { useState, useMemo } from 'react';
import { useNews } from '@/contexts/NewsContext';
import type { NewsItemType, NewsStatus } from '@/contexts/NewsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Eye, Link as LinkIcon, Archive, ArchiveRestore, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const newsSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
    snippet: z.string().min(10, "Snippet deve ter no mínimo 10 caracteres"),
    content: z.string().min(10, "Conteúdo completo deve ter no mínimo 10 caracteres"),
    category: z.string().min(1, "Categoria é obrigatória"),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Data inválida" }),
    imageUrl: z.string().url("URL da imagem principal inválida."),
    videoUrl: z.string().url("URL do vídeo inválida.").optional().or(z.literal('')),
    link: z.string().url("URL do link inválida").optional().or(z.literal('')),
});

type NewsFormValues = z.infer<typeof newsSchema>;

const statusConfig: { [key in NewsStatus]: { label: string, color: string } } = {
  draft: { label: 'Rascunho', color: 'bg-yellow-500' },
  approved: { label: 'Aprovado', color: 'bg-blue-500' },
  published: { label: 'Publicado', color: 'bg-green-500' },
  archived: { label: 'Arquivado', color: 'bg-gray-500' },
};

export function ManageNews() {
    const { newsItems, addNewsItem, updateNewsItem, archiveNewsItem, updateNewsStatus, toggleNewsHighlight, updateHighlightType, deleteNewsItemMutation } = useNews();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [editingNews, setEditingNews] = useState<NewsItemType | null>(null);
    const [previewingNews, setPreviewingNews] = useState<NewsItemType | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    
    const displayedNews = useMemo(() => {
        return newsItems
          .filter(item => showArchived ? item.status === 'archived' : item.status !== 'archived')
          .sort((a,b) => (a.order || 0) - (b.order || 0));
    }, [newsItems, showArchived]);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<NewsFormValues>({
        resolver: zodResolver(newsSchema),
    });

    const handleDialogOpen = (newsItem: NewsItemType | null) => {
        setEditingNews(newsItem);
        if (newsItem) {
            const formattedNews = {
              ...newsItem,
              date: new Date(newsItem.date).toISOString().split('T')[0],
              link: newsItem.link || '',
              videoUrl: newsItem.videoUrl || '',
            };
            reset(formattedNews);
        } else {
            reset({
                id: undefined,
                title: 'Exemplo Veneto (Editar para mudar)',
                snippet: 'Este é um snippet de exemplo para testes do layout.',
                content: 'Conteúdo detalhado da notícia de exemplo. Pode conter várias linhas e explicações.',
                category: 'Institucional',
                date: new Date().toISOString().split('T')[0],
                imageUrl: 'https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2Flogo_oficial_branca.png?alt=media&token=329d139b-cca1-4aed-95c7-a699fa32f0bb',
                videoUrl: '',
                link: '',
            });
        }
        setIsDialogOpen(true);
    };

    const handlePreviewOpen = (newsItem: NewsItemType) => {
        setPreviewingNews(newsItem);
        setIsPreviewOpen(true);
    };

    const handleDelete = async (itemToDelete: NewsItemType) => {
        if (!window.confirm(`Tem certeza que deseja excluir permanentemente a notícia "${itemToDelete.title}"? Esta ação não pode ser desfeita.`)) return;
        
        try {
            await deleteNewsItemMutation.mutateAsync(itemToDelete.id);
            toast({
                title: "Exclusão Concluída",
                description: `A notícia "${itemToDelete.title}" foi removida com sucesso.`,
                variant: 'success'
            });
        } catch (error) {
            toast({
                title: "Falha na Exclusão",
                description: `Não foi possível remover a notícia. Causa: ${(error as Error).message}`,
                variant: "destructive"
            });
        }
    };

    const handleArchive = async (id: string, title: string) => {
        if (!window.confirm(`Tem certeza que deseja arquivar a notícia "${title}"?`)) return;
        try {
          await archiveNewsItem(id);
          toast({ title: "Notícia arquivada com sucesso." });
        } catch (error) {
          toast({ title: "Erro ao arquivar", description: (error as Error).message, variant: "destructive" });
        }
    };

    const handleOrderChange = async (newsId: string, newOrder: number) => {
        try {
            await updateNewsItem({ id: newsId, order: newOrder });
            toast({ title: "Ordem da notícia atualizada." });
        } catch (error) {
            toast({ title: "Erro ao atualizar a ordem", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: NewsFormValues) => {
        try {
            if (editingNews) {
                await updateNewsItem({ ...data, id: editingNews.id });
                toast({ title: "Notícia atualizada com sucesso." });
            } else {
                await addNewsItem(data as Omit<NewsItemType, 'id'>);
                toast({ title: "Notícia criada com sucesso." });
            }
            setIsDialogOpen(false);
        } catch (error) {
             toast({
                title: "Erro ao salvar notícia",
                description: `Falha: ${(error as Error).message}`,
                variant: "destructive"
            });
        }
    };
    
    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Gerenciar Notícias</CardTitle>
                        <CardDescription>Adicione, edite ou remova notícias do feed. Altere o número da ordem para reordenar.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
                            {showArchived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                            {showArchived ? "Mostrar Ativas" : "Ver Arquivadas"}
                        </Button>
                        <Button onClick={() => handleDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adicionar Notícia
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Ordem</TableHead>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Destaque</TableHead>
                                    <TableHead>Tipo de Destaque</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayedNews.map((item) => (
                                    <TableRow 
                                        key={item.id}
                                        className={cn(
                                            item.status === 'archived' ? 'bg-muted/50' : ''
                                        )}
                                    >
                                        <TableCell>
                                            <Input
                                                type="number"
                                                defaultValue={item.order}
                                                onBlur={(e) => handleOrderChange(item.id, parseInt(e.target.value, 10))}
                                                className="w-20"
                                                disabled={item.status === 'archived'}
                                            />
                                        </TableCell>
                                        <TableCell className={cn("font-medium", item.status === 'archived' && 'text-muted-foreground')}>
                                          {item.title}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                              value={item.status}
                                              onValueChange={(value) => updateNewsStatus(item.id, value as NewsStatus)}
                                              disabled={item.status === 'archived'}
                                            >
                                                <SelectTrigger className="w-[130px]">
                                                    <SelectValue>
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("h-2 w-2 rounded-full", statusConfig[item.status].color)} />
                                                            {statusConfig[item.status].label}
                                                        </div>
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(statusConfig).map(([key, config]) => (
                                                        <SelectItem key={key} value={key} disabled={key === 'archived'}>
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn("h-2 w-2 rounded-full", config.color)} />
                                                                {config.label}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={item.isHighlight}
                                                onCheckedChange={() => toggleNewsHighlight(item.id)}
                                                aria-label="Marcar como destaque"
                                                disabled={item.status !== 'published'}
                                            />
                                        </TableCell>
                                         <TableCell>
                                            {item.isHighlight && (
                                                 <Select
                                                    defaultValue={item.highlightType || 'small'}
                                                    onValueChange={(value) => updateHighlightType(item.id, value as 'large' | 'small')}
                                                    disabled={item.status !== 'published'}
                                                >
                                                    <SelectTrigger className="w-[120px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="small">Pequeno</SelectItem>
                                                        <SelectItem value="large">Grande</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handlePreviewOpen(item)} className="hover:bg-muted" title="Visualizar">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(item)} className="hover:bg-muted" title="Editar">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            {item.status !== 'archived' ? (
                                                <Button variant="ghost" size="icon" onClick={() => handleArchive(item.id, item.title)} className="hover:bg-muted" title="Arquivar">
                                                    <Archive className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            ) : (
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="hover:bg-muted" title="Excluir Permanentemente" disabled={deleteNewsItemMutation.isPending && deleteNewsItemMutation.variables === item.id}>
                                                    {deleteNewsItemMutation.isPending && deleteNewsItemMutation.variables === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive" />}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl">
                    {previewingNews && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="font-headline text-2xl text-left">{previewingNews.title}</DialogTitle>
                                <div className="text-left !mt-2">
                                    <Badge variant="outline" className="font-body text-foreground">{previewingNews.category}</Badge>
                                    <span className="text-xs text-muted-foreground font-body ml-2">
                                        {new Date(previewingNews.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] pr-6">
                                <div className="space-y-6">
                                    <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4 bg-black">
                                        {previewingNews.videoUrl ? (
                                            <video src={previewingNews.videoUrl} controls autoPlay className="w-full h-full object-contain" />
                                        ) : (
                                            <Image
                                                src={previewingNews.imageUrl}
                                                alt={previewingNews.title}
                                                layout="fill"
                                                objectFit="cover"
                                            />
                                        )}
                                    </div>
                                    
                                    <div className="py-4 text-sm text-foreground">
                                        {previewingNews.content && <p className="whitespace-pre-wrap">{previewingNews.content}</p>}
                                        {previewingNews.link && (
                                            <div className="mt-4">
                                                <Button variant="outline" asChild>
                                                    <a href={previewingNews.link} target="_blank" rel="noopener noreferrer">
                                                        <LinkIcon className="mr-2 h-4 w-4" />
                                                        Acessar Link
                                                    </a>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <Separator />

                                    <div>
                                        <h3 className="font-headline text-lg font-bold mb-4">Prévia do Destaque na Tela Inicial</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold text-center">Destaque Grande</p>
                                                <div className="relative rounded-lg overflow-hidden h-64 w-full bg-black">
                                                    {previewingNews.videoUrl ? (
                                                        <video src={previewingNews.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Image src={previewingNews.imageUrl} alt="Preview grande" layout="fill" objectFit="cover" />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 flex flex-col justify-end">
                                                        <h3 className="text-xl font-headline font-bold text-white">{previewingNews.title}</h3>
                                                        <p className="text-sm text-gray-200 font-body">{previewingNews.snippet}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold text-center">Destaque Pequeno</p>
                                                <div className="relative rounded-lg overflow-hidden h-40 w-full bg-black">
                                                     {previewingNews.videoUrl ? (
                                                        <video src={previewingNews.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Image src={previewingNews.imageUrl} alt="Preview pequeno" layout="fill" objectFit="cover" />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 flex flex-col justify-end">
                                                        <h3 className="text-lg font-headline font-bold text-white">{previewingNews.title}</h3>
                                                        <p className="text-xs text-gray-200 font-body">{previewingNews.snippet}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <DialogFooter className="pt-4">
                                <DialogClose asChild>
                                <Button type="button" variant="outline" className="hover:bg-muted">Fechar</Button>
                                </DialogClose>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

             <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingNews(null); setIsDialogOpen(isOpen); }}>
                <DialogContent className="max-w-2xl">
                   <ScrollArea className="max-h-[80vh]">
                     <div className="p-6 pt-0">
                        <DialogHeader>
                            <DialogTitle>{editingNews ? 'Editar Notícia' : 'Adicionar Notícia'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                            <div>
                                <Label htmlFor="title">Título</Label>
                                <Input id="title" {...register('title')} disabled={isSubmitting}/>
                                {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="snippet">Snippet (texto curto para o card)</Label>
                                <Textarea id="snippet" {...register('snippet')} disabled={isSubmitting} rows={3}/>
                                {errors.snippet && <p className="text-sm text-destructive mt-1">{errors.snippet.message}</p>}
                            </div>
                             <div>
                                <Label htmlFor="content">Conteúdo Completo (para o modal)</Label>
                                <Textarea id="content" {...register('content')} disabled={isSubmitting} rows={7}/>
                                {errors.content && <p className="text-sm text-destructive mt-1">{errors.content.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="category">Categoria</Label>
                                <Input id="category" {...register('category')} disabled={isSubmitting}/>
                                {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="date">Data</Label>
                                <Input id="date" type="date" {...register('date')} disabled={isSubmitting}/>
                                {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
                            </div>
                             <div>
                                <Label htmlFor="imageUrl">URL da Imagem Principal</Label>
                                <Input id="imageUrl" {...register('imageUrl')} placeholder="https://..." disabled={isSubmitting}/>
                                {errors.imageUrl && <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="videoUrl">URL do Vídeo (Opcional)</Label>
                                <Input id="videoUrl" {...register('videoUrl')} placeholder="https://..." disabled={isSubmitting}/>
                                {errors.videoUrl && <p className="text-sm text-destructive mt-1">{errors.videoUrl.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="link">URL do Link (opcional)</Label>
                                <Input id="link" {...register('link')} placeholder="https://..." disabled={isSubmitting}/>
                                {errors.link && <p className="text-sm text-destructive mt-1">{errors.link.message}</p>}
                            </div>
                            
                            <DialogFooter className="pt-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </form>
                      </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}

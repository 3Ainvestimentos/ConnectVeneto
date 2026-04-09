
"use client";

import React, { useMemo } from 'react';
import SuperAdminGuard from '@/components/auth/SuperAdminGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCollection, WithId, listenToCollection } from '@/lib/firestore-service';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Eye, FileText, Newspaper, User, Medal, FileDown, Route, Trophy } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import Papa from 'papaparse';
import { format, parseISO, startOfDay, isWithinInterval, endOfDay } from 'date-fns';
import { useAudit } from '@/contexts/AuditContext';

type AuditLogEvent = WithId<{
    eventType: 'document_download' | 'login' | 'page_view' | 'content_view';
    userId: string;
    userName: string;
    timestamp: string; // ISO String
    details: {
        documentId?: string;
        documentName?: string;
        path?: string;
        message?: string;
        contentId?: string;
        contentTitle?: string;
        contentType?: 'news' | 'document';
    }
}>;

export default function ContentInteractionPage() {
    const queryClient = useQueryClient();
    const { dateRange } = useAudit();

    React.useEffect(() => {
        const unsubscribe = listenToCollection<AuditLogEvent>(
            'audit_logs',
            (newData) => {
                queryClient.setQueryData(['audit_logs'], newData);
            },
            (error) => {
                console.error("Failed to listen to audit logs:", error);
            }
        );
        return () => unsubscribe();
    }, [queryClient]);
    
    const { data: allEvents = [], isLoading } = useQuery<AuditLogEvent[]>({
        queryKey: ['audit_logs'],
        queryFn: () => getCollection<AuditLogEvent>('audit_logs'),
    });

    const events = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        
        const from = startOfDay(dateRange.from);
        const to = endOfDay(dateRange.to);

        return allEvents.filter(e => {
            const isRelevantEvent = e.eventType === 'content_view' || e.eventType === 'document_download' || e.eventType === 'page_view';
            const eventDate = parseISO(e.timestamp);
            return isRelevantEvent && isWithinInterval(eventDate, { start: from, end: to });
        });
    }, [allEvents, dateRange]);


    const { contentStats, top5Contents, pageAccessCounts } = useMemo(() => {
        if (isLoading || !events.length) return { contentStats: [], top5Contents: [], pageAccessCounts: [] };

        const viewEvents = events.filter(e => e.eventType === 'content_view' || e.eventType === 'document_download');

        const stats: { [contentId: string]: { title: string; type: string; totalViews: number; uniqueViewers: Set<string> } } = {};

        viewEvents.forEach(event => {
            const contentId = event.details.contentId || event.details.documentId;
            if (!contentId) return;
            
            if (!stats[contentId]) {
                stats[contentId] = {
                    title: event.details.contentTitle || event.details.documentName || 'Título desconhecido',
                    type: event.eventType === 'content_view' ? 'Notícia' : 'Documento',
                    totalViews: 0,
                    uniqueViewers: new Set(),
                };
            }

            stats[contentId].totalViews += 1;
            stats[contentId].uniqueViewers.add(event.userId);
        });
        
        const pageAccess = events
            .filter(e => e.eventType === 'page_view' && e.details.path)
            .reduce((acc, event) => {
                const path = event.details.path!;
                acc[path] = (acc[path] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const pageAccessCounts = Object.entries(pageAccess)
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count);

        const contentStats = Object.entries(stats)
          .map(([id, s]) => ({ id, ...s, uniqueViews: s.uniqueViewers.size }))
          .sort((a, b) => b.uniqueViews - a.uniqueViews);
          
        const top5Contents = contentStats.slice(0, 5);


        return { contentStats, top5Contents, pageAccessCounts };

    }, [events, isLoading]);

    const handleExport = () => {
        const dataForCsv = contentStats.map(item => ({
            'Conteúdo': item.title,
            'Tipo': item.type,
            'Total de Visualizações': item.totalViews,
            'Visualizadores Únicos': item.uniqueViews,
        }));

        const csv = Papa.unparse(dataForCsv);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_interacao_conteudo_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const renderSkeleton = () => (
        <div className="space-y-2">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
    );

    return (
        <SuperAdminGuard>
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Eye className="h-6 w-6"/>Análise de Conteúdos e Páginas</CardTitle>
                            <CardDescription>Análise de visualizações, downloads e acessos para entender o engajamento no período selecionado.</CardDescription>
                        </div>
                        <Button onClick={handleExport} disabled={isLoading || contentStats.length === 0} className="bg-admin-primary hover:bg-admin-primary/90">
                            <FileDown className="mr-2 h-4 w-4" />
                            Exportar CSV
                        </Button>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Conteúdo Mais Popular</CardTitle>
                            <Medal className="h-5 w-5 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-8 w-3/4" /> : top5Contents.length > 0 ? (
                                <>
                                    <p className="text-xl font-bold">{top5Contents[0].title}</p>
                                    <p className="text-xs text-muted-foreground">{top5Contents[0].uniqueViews} visualizadores únicos</p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Sem dados.</p>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500"/> Top 5 Conteúdos Populares</CardTitle>
                            <CardDescription>Conteúdos com mais visualizadores únicos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-24 w-full" /> : top5Contents.length > 0 ? (
                                <ol className="space-y-2 text-sm">
                                    {top5Contents.map((item, index) => (
                                        <li key={item.id} className="flex items-center justify-between gap-2">
                                            <span className="truncate"><strong>{index + 1}.</strong> {item.title}</span>
                                            <Badge variant="secondary">{item.uniqueViews} visualizações</Badge>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <p className="text-sm text-muted-foreground">Sem dados de visualização.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg">Tabela Sintética de Conteúdo</CardTitle>
                            <CardDescription>Lista de todo o conteúdo consumido, ordenado por visualizadores únicos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? renderSkeleton() : (
                                <div className="border rounded-lg overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Conteúdo</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Total de Visualizações</TableHead>
                                                <TableHead>Visualizadores Únicos</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {contentStats.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.title}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                                                            {item.type === 'Notícia' ? <Newspaper className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                                            {item.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1.5">
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                        {item.totalViews}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1.5 font-semibold">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        {item.uniqueViews}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                            {!isLoading && contentStats.length === 0 && (
                                <div className="text-center py-10 px-6 border-2 border-dashed rounded-lg">
                                    <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-medium text-foreground">Nenhuma interação registrada</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Ainda não há dados de visualização de conteúdo para exibir.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Tabela Sintética de Páginas</CardTitle>
                            <CardDescription>Contagem total de acessos para cada página da intranet.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Página</TableHead>
                                            <TableHead className="text-right">Acessos</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pageAccessCounts.map((page) => (
                                            <TableRow key={page.path}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                    <Route className="h-4 w-4 text-muted-foreground" />
                                                    {page.path}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold">{page.count}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SuperAdminGuard>
    );
}

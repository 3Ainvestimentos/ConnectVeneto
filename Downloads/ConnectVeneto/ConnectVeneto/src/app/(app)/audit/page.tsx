
"use client";

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCollection, WithId } from '@/lib/firestore-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { LineChart as LineChartIcon, LogIn, BarChart as BarChartIcon, Users as UsersIcon, FileDown, ThumbsUp, ThumbsDown, Trophy, Filter } from 'lucide-react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, BarChart, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfDay, eachDayOfInterval, compareAsc, endOfDay, isWithinInterval, subMonths, getDay, getHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { Progress } from '@/shared/components/ui/progress';
import { Button } from '@/shared/components/ui/button';
import Papa from 'papaparse';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useAudit } from '@/contexts/AuditContext';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

const CHART_COLORS = [
    '#3b82f6', // Azul
    '#22c55e', // Verde
    '#f97316', // Laranja
    '#a855f7', // Roxo
    '#ef4444', // Vermelho
];

type AuditLogEvent = WithId<{
    eventType: 'document_download' | 'login' | 'page_view' | 'content_view' | 'search_term_used';
    userId: string;
    userName: string;
    timestamp: string;
    details: Record<string, unknown>;
}>;

export default function AuditPage() {
    const { dateRange } = useAudit();
    const { settings, loading: loadingSettings } = useSystemSettings();
    const [loginView, setLoginView] = useState<'total' | 'unique'>('total');
    const [axisFilter, setAxisFilter] = useState<string[]>([]);

    const { data: allLoginEvents = [], isLoading: isLoadingAllEvents } = useQuery<AuditLogEvent[]>({
        queryKey: ['audit_logs', 'login', 'all'],
        queryFn: async () => {
            const allEvents = await getCollection<AuditLogEvent>('audit_logs');
            return allEvents
                .filter(e => e.eventType === 'login')
                .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        },
        staleTime: 5 * 60 * 1000,
    });

    const periodEvents = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        const from = startOfDay(dateRange.from);
        const to = endOfDay(dateRange.to);
        return allLoginEvents.filter(e => {
            const eventDate = parseISO(e.timestamp);
            return isWithinInterval(eventDate, { start: from, end: to });
        });
    }, [allLoginEvents, dateRange]);

    const historicalEvents = useMemo(() => {
        const sixMonthsAgo = startOfDay(subMonths(new Date(), 6));
        const today = endOfDay(new Date());
        return allLoginEvents.filter(e => {
            const eventDate = parseISO(e.timestamp);
            return isWithinInterval(eventDate, { start: sixMonthsAgo, end: today });
        });
    }, [allLoginEvents]);

    const isLoadingPeriodEvents = isLoadingAllEvents;
    const isLoadingHistorical = isLoadingAllEvents;

    const { collaborators, loading: loadingCollaborators } = useCollaborators();

    const isLoading = isLoadingPeriodEvents || loadingCollaborators || loadingSettings;

    // Eixos únicos dos colaboradores (ordenados)
    const uniqueAxes = useMemo(() => {
        return [...new Set(collaborators.map(c => c.axis).filter(Boolean))].sort();
    }, [collaborators]);

    // Mapa userId (idVeneto) → axis para classificação dos eventos
    const userIdToAxis = useMemo(() => {
        const map = new Map<string, string>();
        collaborators.forEach(c => {
            if (c.idVeneto && c.axis) map.set(c.idVeneto, c.axis);
        });
        return map;
    }, [collaborators]);

    // Paleta de cores por eixo (dinâmica, baseada em índice)
    const axisColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        uniqueAxes.forEach((axis, i) => {
            map[axis] = CHART_COLORS[i % CHART_COLORS.length];
        });
        return map;
    }, [uniqueAxes]);

    // Eixos ativos conforme filtro selecionado
    const activeAxes = useMemo(() => {
        return axisFilter.length > 0 ? axisFilter : uniqueAxes;
    }, [axisFilter, uniqueAxes]);

    // Eventos do período filtrados por eixo (quando filtro ativo)
    const filteredEvents = useMemo(() => {
        if (axisFilter.length === 0) return periodEvents;
        return periodEvents.filter(e => {
            const axis = userIdToAxis.get(e.userId);
            return axis !== undefined && axisFilter.includes(axis);
        });
    }, [periodEvents, axisFilter, userIdToAxis]);

    // Eventos históricos filtrados por eixo
    const filteredHistoricalEvents = useMemo(() => {
        if (axisFilter.length === 0) return historicalEvents;
        return historicalEvents.filter(e => {
            const axis = userIdToAxis.get(e.userId);
            return axis !== undefined && axisFilter.includes(axis);
        });
    }, [historicalEvents, axisFilter, userIdToAxis]);

    // Colaboradores filtrados por eixo (para contagem total)
    const filteredCollaborators = useMemo(() => {
        return axisFilter.length > 0
            ? collaborators.filter(c => axisFilter.includes(c.axis))
            : collaborators;
    }, [collaborators, axisFilter]);

    const toggleAxisFilter = (axis: string) => {
        setAxisFilter(prev =>
            prev.includes(axis) ? prev.filter(a => a !== axis) : [...prev, axis]
        );
    };

    // Stats de engajamento por usuário (inclui axis para badge)
    const userLoginStats = useMemo(() => {
        if (isLoading || collaborators.length === 0) return [];

        const loginCounts = filteredEvents.reduce((acc, event) => {
            acc[event.userId] = (acc[event.userId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return filteredCollaborators.map(collab => ({
            id: getCollaboratorUserId(collab) || collab.id,
            name: collab.name,
            photoURL: collab.photoURL,
            axis: collab.axis,
            count: loginCounts[getCollaboratorUserId(collab) || ''] || 0,
        })).sort((a, b) => b.count - a.count);
    }, [filteredEvents, filteredCollaborators, collaborators.length, isLoading]);

    // Logins acumulados no período (filtrado por eixo)
    const cumulativeLogins = useMemo(() => {
        if (isLoading || filteredEvents.length === 0 || !dateRange?.from || !dateRange.to) return [];

        const loginEvents = [...filteredEvents].sort((a, b) =>
            compareAsc(parseISO(a.timestamp), parseISO(b.timestamp))
        );

        const startDate = startOfDay(dateRange.from);
        const endDate = startOfDay(dateRange.to);
        const dateRangeInterval = eachDayOfInterval({ start: startDate, end: endDate });

        const loginsByDay: { [key: string]: number } = {};
        loginEvents.forEach(event => {
            const dayKey = format(startOfDay(parseISO(event.timestamp)), 'yyyy-MM-dd');
            loginsByDay[dayKey] = (loginsByDay[dayKey] || 0) + 1;
        });

        let accumulatedLogins = 0;
        return dateRangeInterval.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            accumulatedLogins += (loginsByDay[dayKey] || 0);
            return {
                date: format(day, 'dd/MM'),
                'Logins Acumulados': accumulatedLogins,
            };
        });
    }, [filteredEvents, isLoading, dateRange]);

    // Dados brutos do gráfico de barras por eixo por dia
    const loginsByDayByAxisRaw = useMemo(() => {
        if (isLoading || !dateRange?.from || !dateRange?.to) return [];

        const endDate = endOfDay(dateRange.to);
        const startDate = startOfDay(dateRange.from);
        const dateRangeInterval = eachDayOfInterval({ start: startDate, end: endDate });

        const byDay: { [dayKey: string]: { [axis: string]: { total: number; uniqueUsers: Set<string> } } } = {};

        filteredEvents.forEach(event => {
            const eventDate = parseISO(event.timestamp);
            if (!isWithinInterval(eventDate, { start: startDate, end: endDate })) return;
            const dayKey = format(startOfDay(eventDate), 'yyyy-MM-dd');
            const axis = userIdToAxis.get(event.userId);
            if (!axis) return;
            if (!byDay[dayKey]) byDay[dayKey] = {};
            if (!byDay[dayKey][axis]) byDay[dayKey][axis] = { total: 0, uniqueUsers: new Set() };
            byDay[dayKey][axis].total += 1;
            byDay[dayKey][axis].uniqueUsers.add(event.userId);
        });

        return dateRangeInterval.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            return {
                date: format(day, 'dd/MM'),
                byAxis: byDay[dayKey] ?? {},
            };
        });
    }, [filteredEvents, isLoading, dateRange, userIdToAxis]);

    // Dados planos para o gráfico (total de logins por eixo por dia)
    const loginsByDayByAxisTotal = useMemo(() => {
        return loginsByDayByAxisRaw.map(row => {
            const flat: Record<string, string | number> = { date: row.date };
            activeAxes.forEach(axis => {
                flat[axis] = row.byAxis[axis]?.total ?? 0;
            });
            return flat;
        });
    }, [loginsByDayByAxisRaw, activeAxes]);

    // Dados planos para o gráfico (usuários únicos por eixo por dia)
    const loginsByDayByAxisUnique = useMemo(() => {
        return loginsByDayByAxisRaw.map(row => {
            const flat: Record<string, string | number> = { date: row.date };
            activeAxes.forEach(axis => {
                flat[axis] = row.byAxis[axis]?.uniqueUsers.size ?? 0;
            });
            return flat;
        });
    }, [loginsByDayByAxisRaw, activeAxes]);

    // Logins únicos no período (filtrado por eixo)
    const uniqueLoginsThisMonth = useMemo(() => {
        const totalCount = filteredCollaborators.length;
        if (isLoading || filteredEvents.length === 0) {
            return { uniqueCount: 0, totalCount, percentage: 0 };
        }
        const uniqueUserIds = new Set(filteredEvents.map(event => event.userId));
        return {
            uniqueCount: uniqueUserIds.size,
            totalCount,
            percentage: totalCount > 0 ? (uniqueUserIds.size / totalCount) * 100 : 0,
        };
    }, [filteredEvents, filteredCollaborators, isLoading]);

    // Frequência média de logins (filtrado por eixo)
    const frequencyStats = useMemo(() => {
        const goal = settings?.loginFrequencyGoal || 12;
        if (isLoading || filteredEvents.length === 0) {
            return { averageLoginsPerUser: 0, goal, percentage: 0 };
        }
        const uniqueUserIds = new Set(filteredEvents.map(event => event.userId));
        const totalLogins = filteredEvents.length;
        const averageLoginsPerUser = uniqueUserIds.size > 0 ? totalLogins / uniqueUserIds.size : 0;
        return {
            averageLoginsPerUser,
            goal,
            percentage: goal > 0 ? Math.min((averageLoginsPerUser / goal) * 100, 100) : 0,
        };
    }, [filteredEvents, isLoading, settings?.loginFrequencyGoal]);

    // Logins por hora do dia (filtrado por eixo)
    const loginsByHour = useMemo(() => {
        if (isLoading || filteredEvents.length === 0) return [];
        const hourCounts: { [key: number]: number } = {};
        for (let i = 0; i < 24; i++) hourCounts[i] = 0;
        filteredEvents.forEach(event => {
            const hour = getHours(parseISO(event.timestamp));
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        return Array.from({ length: 24 }, (_, i) => ({
            hour: `${i.toString().padStart(2, '0')}h`,
            logins: hourCounts[i] || 0,
        }));
    }, [filteredEvents, isLoading]);

    // Logins por dia da semana (filtrado por eixo)
    const loginsByDayOfWeek = useMemo(() => {
        if (isLoading || filteredEvents.length === 0) return [];
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dayCounts: { [key: number]: number } = {};
        for (let i = 0; i < 7; i++) dayCounts[i] = 0;
        filteredEvents.forEach(event => {
            const dayOfWeek = getDay(parseISO(event.timestamp));
            dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
        });
        return dayNames.map((name, index) => ({
            day: name,
            logins: dayCounts[index] || 0,
        }));
    }, [filteredEvents, isLoading]);

    // Histórico de 6 meses (filtrado por eixo)
    const monthlyHistory = useMemo(() => {
        if (isLoadingHistorical || filteredHistoricalEvents.length === 0) return [];
        const monthData: { [key: string]: { uniqueUsers: Set<string>; totalLogins: number } } = {};
        filteredHistoricalEvents.forEach(event => {
            const monthKey = format(parseISO(event.timestamp), 'yyyy-MM');
            if (!monthData[monthKey]) monthData[monthKey] = { uniqueUsers: new Set(), totalLogins: 0 };
            monthData[monthKey].uniqueUsers.add(event.userId);
            monthData[monthKey].totalLogins += 1;
        });
        const months: string[] = [];
        for (let i = 5; i >= 0; i--) months.push(format(subMonths(new Date(), i), 'yyyy-MM'));
        return months.map(monthKey => {
            const monthName = format(parseISO(`${monthKey}-01`), 'MMM', { locale: ptBR });
            return {
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                'Logins Únicos': monthData[monthKey]?.uniqueUsers.size || 0,
                'Logins Totais': monthData[monthKey]?.totalLogins || 0,
            };
        });
    }, [filteredHistoricalEvents, isLoadingHistorical]);

    const handleExport = () => {
        const dataForCsv = filteredEvents.map(event => ({
            'Nome do Colaborador': event.userName,
            'ID do Colaborador': event.userId,
            'Eixo': userIdToAxis.get(event.userId) ?? '',
            'Data e Hora do Login': format(parseISO(event.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
        }));
        const csv = Papa.unparse(dataForCsv);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_logins_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Dropdown de filtro por eixo (reutilizado em cards e tabelas)
    const AxisFilterDropdown = () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrar Eixo ({axisFilter.length || 'Todos'})
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Filtrar por Eixo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="max-h-60">
                    {uniqueAxes.map(axis => (
                        <DropdownMenuCheckboxItem
                            key={axis}
                            checked={axisFilter.includes(axis)}
                            onCheckedChange={() => toggleAxisFilter(axis)}
                        >
                            <span
                                className="inline-block w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                                style={{ backgroundColor: axisColorMap[axis] }}
                            />
                            {axis}
                        </DropdownMenuCheckboxItem>
                    ))}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const UserEngagementList = ({ users, title, icon: Icon }: {
        users: typeof userLoginStats;
        title: string;
        icon: React.ElementType;
    }) => (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" />{title}</CardTitle>
                    <AxisFilterDropdown />
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Eixo</TableHead>
                                <TableHead className="text-right">Logins</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium truncate">{user.name}</span>
                                    </TableCell>
                                    <TableCell>
                                        {user.axis ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                                <span
                                                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: axisColorMap[user.axis] ?? 'hsl(var(--muted-foreground))' }}
                                                />
                                                {user.axis}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">{user.count}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                    <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                </div>
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
            </div>
        );
    }

    const chartData = loginView === 'total' ? loginsByDayByAxisTotal : loginsByDayByAxisUnique;

    return (
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2"><LogIn className="h-6 w-6" />Análise de Logins</CardTitle>
                            <CardDescription>Análise da frequência e do volume de acessos à plataforma no período selecionado.</CardDescription>
                        </div>
                        <Button onClick={handleExport} disabled={isLoading || filteredEvents.length === 0} className="bg-admin-primary hover:bg-admin-primary/90">
                            <FileDown className="mr-2 h-4 w-4" />
                            Exportar CSV
                        </Button>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <UserEngagementList
                        users={userLoginStats.slice(0, 20)}
                        title="Mais Engajados (Top 20)"
                        icon={ThumbsUp}
                    />
                    <UserEngagementList
                        users={[...userLoginStats].sort((a, b) => a.count - b.count).slice(0, 20)}
                        title="Menos Engajados (Top 20)"
                        icon={ThumbsDown}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><LineChartIcon className="h-5 w-5" />Total Acumulado de Logins</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={cumulativeLogins}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} />
                                    <Legend />
                                    <Line type="monotone" dataKey="Logins Acumulados" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Gráfico de barras por eixo */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <CardTitle className="flex items-center gap-2 text-lg"><BarChartIcon className="h-5 w-5" />Logins no Período</CardTitle>
                                <div className="flex items-center gap-2">
                                    <AxisFilterDropdown />
                                    <Tabs defaultValue="total" onValueChange={(v) => setLoginView(v as 'total' | 'unique')}>
                                        <TabsList className="h-8">
                                            <TabsTrigger value="total" className="text-xs h-6">Total</TabsTrigger>
                                            <TabsTrigger value="unique" className="text-xs h-6">Único</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--background))",
                                            borderColor: "hsl(var(--border))",
                                            borderRadius: "var(--radius)",
                                        }}
                                        cursor={{ fill: 'hsl(var(--muted))' }}
                                    />
                                    <Legend />
                                    {activeAxes.map((axis, index) => (
                                        <Bar
                                            key={axis}
                                            dataKey={axis}
                                            stackId="a"
                                            fill={axisColorMap[axis] ?? CHART_COLORS[index % CHART_COLORS.length]}
                                            radius={index === activeAxes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Trophy className="h-5 w-5" />
                                Frequência Média de Logins
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-2xl font-bold">
                                    {(frequencyStats?.averageLoginsPerUser ?? 0).toFixed(1)} logins/usuário
                                </p>
                                <Progress value={frequencyStats?.percentage ?? 0} className="h-3 [&>div]:bg-[hsl(var(--admin-primary))]" />
                                <p className="text-sm text-muted-foreground">
                                    Meta: {frequencyStats?.goal ?? 12} logins/mês por usuário ({(frequencyStats?.percentage ?? 0).toFixed(1)}% da meta)
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <UsersIcon className="h-5 w-5" />
                                Logins Únicos (no Período)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-2xl font-bold">
                                    {uniqueLoginsThisMonth.uniqueCount} de {uniqueLoginsThisMonth.totalCount} colaboradores
                                </p>
                                <Progress value={uniqueLoginsThisMonth.percentage} className="h-3 [&>div]:bg-[hsl(var(--admin-primary))]" />
                                <p className="text-sm text-muted-foreground">
                                    {uniqueLoginsThisMonth.percentage.toFixed(1)}% dos colaboradores fizeram login pelo menos uma vez no período selecionado.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <BarChartIcon className="h-5 w-5" />
                                Logins por Hora do Dia
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={loginsByHour}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} cursor={{ fill: 'hsl(var(--muted))' }} />
                                    <Bar dataKey="logins" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <BarChartIcon className="h-5 w-5" />
                                Logins por Dia da Semana
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={loginsByDayOfWeek}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} cursor={{ fill: 'hsl(var(--muted))' }} />
                                    <Bar dataKey="logins" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <LineChartIcon className="h-5 w-5" />
                            Histórico de Aderência (Últimos 6 Meses)
                        </CardTitle>
                        <CardDescription>
                            Evolução mensal de logins únicos e totais para acompanhar a aderência da plataforma.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingHistorical ? (
                            <Skeleton className="h-64 w-full" />
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={monthlyHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} />
                                    <Legend />
                                    <Line type="monotone" dataKey="Logins Únicos" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                    <Line type="monotone" dataKey="Logins Totais" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
    );
}

"use client";

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Clock, FileDown, LayoutGrid, Search, Users as UsersIcon } from 'lucide-react';
import { getCollectionWithQuery } from '@/lib/firestore-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useAudit } from '@/contexts/AuditContext';
import {
    formatDuration,
    MODULE_USAGE_COLLECTION,
    usageDateKey,
    type ModuleUsageDay,
} from '@/lib/module-usage';

type ModuleRow = { id: string; label: string; seconds: number; visits: number; people: number };
type PersonModuleRow = {
    key: string;
    userName: string;
    email: string;
    personSeconds: number;
    moduleLabel: string;
    seconds: number;
    visits: number;
};

/**
 * Tempo ativo por pessoa e por módulo no período, a partir de `moduleUsage`
 * (gravado por useModuleTimeTracking). "Ativo" = aba visível e interação nos
 * últimos 5 min; tempo com a aba em segundo plano não conta.
 */
export default function ModuleTimePage() {
    const { dateRange } = useAudit();
    const [search, setSearch] = useState('');

    const from = dateRange?.from ? usageDateKey(dateRange.from) : null;
    const to = dateRange?.to ? usageDateKey(dateRange.to) : null;

    const { data: days = [], isLoading, error } = useQuery<ModuleUsageDay[]>({
        queryKey: [MODULE_USAGE_COLLECTION, from, to],
        enabled: !!from && !!to,
        // Faixa num único campo: não exige índice composto.
        queryFn: () =>
            getCollectionWithQuery<ModuleUsageDay>(MODULE_USAGE_COLLECTION, [
                { field: 'date', operator: '>=', value: from },
                { field: 'date', operator: '<=', value: to },
            ]),
    });

    const { moduleRows, personRows, totalSeconds, activePeople } = useMemo(() => {
        const modules = new Map<string, { label: string; seconds: number; visits: number; people: Set<string> }>();
        const people = new Map<
            string,
            { userName: string; email: string; seconds: number; modules: Map<string, { label: string; seconds: number; visits: number }> }
        >();

        for (const day of days) {
            const person = people.get(day.uid) ?? {
                userName: day.userName,
                email: day.email,
                seconds: 0,
                modules: new Map(),
            };
            people.set(day.uid, person);

            for (const [moduleId, entry] of Object.entries(day.modules ?? {})) {
                const seconds = entry.seconds ?? 0;
                const visits = entry.visits ?? 0;

                const moduleTotal = modules.get(moduleId) ?? { label: entry.label, seconds: 0, visits: 0, people: new Set<string>() };
                moduleTotal.seconds += seconds;
                moduleTotal.visits += visits;
                moduleTotal.people.add(day.uid);
                modules.set(moduleId, moduleTotal);

                const personModule = person.modules.get(moduleId) ?? { label: entry.label, seconds: 0, visits: 0 };
                personModule.seconds += seconds;
                personModule.visits += visits;
                person.modules.set(moduleId, personModule);
                person.seconds += seconds;
            }
        }

        const moduleRows: ModuleRow[] = [...modules.entries()]
            .map(([id, m]) => ({ id, label: m.label, seconds: m.seconds, visits: m.visits, people: m.people.size }))
            .sort((a, b) => b.seconds - a.seconds);

        const personRows: PersonModuleRow[] = [...people.entries()]
            .sort(([, a], [, b]) => b.seconds - a.seconds)
            .flatMap(([uid, person]) =>
                [...person.modules.entries()]
                    .sort(([, a], [, b]) => b.seconds - a.seconds)
                    .map(([moduleId, m]) => ({
                        key: `${uid}:${moduleId}`,
                        userName: person.userName,
                        email: person.email,
                        personSeconds: person.seconds,
                        moduleLabel: m.label,
                        seconds: m.seconds,
                        visits: m.visits,
                    }))
            );

        return {
            moduleRows,
            personRows,
            totalSeconds: moduleRows.reduce((sum, row) => sum + row.seconds, 0),
            activePeople: [...people.values()].filter((p) => p.seconds > 0).length,
        };
    }, [days]);

    const filteredPersonRows = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return personRows;
        return personRows.filter(
            (row) =>
                row.userName.toLowerCase().includes(term) ||
                row.email.toLowerCase().includes(term) ||
                row.moduleLabel.toLowerCase().includes(term)
        );
    }, [personRows, search]);

    const handleExport = () => {
        const csv = Papa.unparse(
            filteredPersonRows.map((row) => ({
                'Colaborador': row.userName,
                'E-mail': row.email,
                'Módulo': row.moduleLabel,
                'Tempo ativo (min)': Math.round(row.seconds / 60),
                'Visitas': row.visits,
            }))
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tempo_por_modulo_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const renderSkeleton = () => (
        <div className="space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
    );

    const topModule = moduleRows[0];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Clock className="h-6 w-6" />Tempo por Módulo</CardTitle>
                        <CardDescription>
                            Tempo ativo de cada colaborador em cada módulo no período. Conta só com a aba visível e
                            alguma interação nos últimos 5 minutos.
                        </CardDescription>
                    </div>
                    <Button onClick={handleExport} disabled={isLoading || filteredPersonRows.length === 0} className="bg-admin-primary hover:bg-admin-primary/90">
                        <FileDown className="mr-2 h-4 w-4" />
                        Exportar CSV
                    </Button>
                </CardHeader>
            </Card>

            {error && (
                <p className="text-sm text-destructive">Não foi possível carregar o tempo por módulo.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tempo ativo total</CardTitle>
                        <Clock className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/2" /> : <p className="text-2xl font-bold">{formatDuration(totalSeconds)}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Colaboradores ativos</CardTitle>
                        <UsersIcon className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/3" /> : <p className="text-2xl font-bold">{activePeople}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Módulo com mais tempo</CardTitle>
                        <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-3/4" /> : topModule ? (
                            <>
                                <p className="text-xl font-bold">{topModule.label}</p>
                                <p className="text-xs text-muted-foreground">{formatDuration(topModule.seconds)} · {topModule.people} pessoas</p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Sem dados.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Por módulo</CardTitle>
                        <CardDescription>Soma de todos os colaboradores.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? renderSkeleton() : moduleRows.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum tempo registrado no período.</p>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Módulo</TableHead>
                                            <TableHead className="text-right">Tempo</TableHead>
                                            <TableHead className="text-right">Pessoas</TableHead>
                                            <TableHead className="text-right">Média/pessoa</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {moduleRows.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="font-medium">{row.label}</TableCell>
                                                <TableCell className="text-right font-mono">{formatDuration(row.seconds)}</TableCell>
                                                <TableCell className="text-right">{row.people}</TableCell>
                                                <TableCell className="text-right font-mono">{formatDuration(row.seconds / Math.max(1, row.people))}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader className="space-y-3">
                        <div>
                            <CardTitle className="text-lg">Por colaborador</CardTitle>
                            <CardDescription>Ordenado por quem passou mais tempo no Connect.</CardDescription>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Filtrar por nome, e-mail ou módulo"
                                className="pl-8"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? renderSkeleton() : filteredPersonRows.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro.</p>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Colaborador</TableHead>
                                            <TableHead>Módulo</TableHead>
                                            <TableHead className="text-right">Tempo</TableHead>
                                            <TableHead className="text-right">Visitas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPersonRows.map((row, index) => {
                                            const isFirstOfPerson = index === 0 || filteredPersonRows[index - 1].email !== row.email;
                                            return (
                                                <TableRow key={row.key}>
                                                    <TableCell>
                                                        {isFirstOfPerson && (
                                                            <>
                                                                <p className="font-medium">{row.userName}</p>
                                                                <p className="text-xs text-muted-foreground">Total: {formatDuration(row.personSeconds)}</p>
                                                            </>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{row.moduleLabel}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatDuration(row.seconds)}</TableCell>
                                                    <TableCell className="text-right">{row.visits}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

"use client";

import SuperAdminGuard from "@/components/auth/SuperAdminGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ManageFabMessages } from "@/components/admin/ManageFabMessages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, PieChart, Users, BarChart, Search, Filter, ChevronUp, ChevronDown, BotMessageSquare, MessageCircle } from "lucide-react";
import TagDistributionChart from "@/components/admin/TagDistributionChart";
import CampaignStatusChart from "@/components/admin/CampaignStatusChart";
import CampaignHistoryChart from "@/components/admin/CampaignHistoryChart";
import { useCollaborators, type Collaborator } from "@/contexts/CollaboratorsContext";
import { useFabMessages } from "@/contexts/FabMessagesContext";
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ManageIdleFabMessages } from '@/components/admin/ManageIdleFabMessages';

export default function FabMessagesAdminPage() {
    const { collaborators } = useCollaborators();
    const { fabMessages } = useFabMessages();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => 
        collaborators.filter(c => c.axis === 'Comercial' || ['desenvolvedor@venetomfo.com.br', 'matheus@venetomfo.com.br'].includes(c.email)).map(c => c.id3a)
    );
    
    const [filters, setFilters] = useState<{
        area: string[],
        position: string[],
        segment: string[],
        leader: string[],
        city: string[],
    }>({ area: [], position: [], segment: [], leader: [], city: [] });


    const commercialUsers = useMemo(() => {
        const testUsers = [
            'desenvolvedor@venetomfo.com.br',
            'matheus@venetomfo.com.br'
        ];
        if (!collaborators || !Array.isArray(collaborators)) return [];
        return collaborators
          .filter(c => c && c.name && (c.axis === 'Comercial' || testUsers.includes(c.email)))
          .sort((a,b) => (a?.name || '').localeCompare(b?.name || ''));
    }, [collaborators]);
    
    const { uniqueAreas, uniquePositions, uniqueSegments, uniqueLeaders, uniqueCities } = useMemo(() => {
        const areas = new Set<string>();
        const positions = new Set<string>();
        const segments = new Set<string>();
        const leaders = new Set<string>();
        const cities = new Set<string>();

        commercialUsers.forEach(c => {
            if(c.area) areas.add(c.area);
            if(c.position) positions.add(c.position);
            if(c.segment) segments.add(c.segment);
            if(c.leader) leaders.add(c.leader);
            if(c.city) cities.add(c.city);
        });

        return {
            uniqueAreas: [...areas].sort(),
            uniquePositions: [...positions].sort(),
            uniqueSegments: [...segments].sort(),
            uniqueLeaders: [...leaders].sort(),
            uniqueCities: [...cities].sort()
        }
    }, [commercialUsers]);

    const filteredUsers = useMemo(() => {
        let items = [...commercialUsers];
        
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            items = items.filter(user => 
                user.name.toLowerCase().includes(lowercasedTerm) || 
                user.email.toLowerCase().includes(lowercasedTerm)
            );
        }

        Object.entries(filters).forEach(([key, values]) => {
            if (values.length > 0) {
                items = items.filter(user => values.includes(user[key as keyof Collaborator] as string));
            }
        });

        return items;
    }, [commercialUsers, searchTerm, filters]);
    
    const selectedMessages = useMemo(() => {
        return fabMessages.filter(msg => selectedUserIds.includes(msg.userId));
    }, [fabMessages, selectedUserIds]);

    const handleSelectUser = (userId: string, checked: boolean) => {
        setSelectedUserIds(prev => 
            checked ? [...prev, userId] : prev.filter(id => id !== userId)
        );
    };
    
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedUserIds(filteredUsers.map(u => u.id3a));
        } else {
            setSelectedUserIds([]);
        }
    };

    const handleFilterChange = (filterKey: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const currentValues = prev[filterKey];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterKey]: newValues };
        });
    };
    
    const isAllSelected = useMemo(() => {
        return filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id3a));
    }, [filteredUsers, selectedUserIds]);

    const FilterableHeader = ({ fkey, label, uniqueValues }: { fkey: keyof typeof filters, label: string, uniqueValues: string[] }) => (
        <TableHead>
            <div className="flex items-center gap-2">
                <span className="flex-grow">{label}</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Filtrar por {label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="max-h-60">
                        {uniqueValues.map(value => (
                            <DropdownMenuCheckboxItem
                                key={value}
                                checked={filters[fkey].includes(value)}
                                onCheckedChange={() => handleFilterChange(fkey, value)}
                            >
                                {value}
                            </DropdownMenuCheckboxItem>
                        ))}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </TableHead>
    );

    return (
        <SuperAdminGuard>
            <div className="space-y-6 p-6 md:p-8">
                <PageHeader
                    title="Mensagens FAB"
                    description="Crie, monitore e gerencie mensagens flutuantes para os usuários."
                />
                
                 <Tabs defaultValue="management" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="management">
                             <ListChecks className="mr-2 h-4 w-4" />
                             Campanhas Ativas
                        </TabsTrigger>
                        <TabsTrigger value="idle_messages">
                             <MessageCircle className="mr-2 h-4 w-4" />
                             Mensagens Ociosas
                        </TabsTrigger>
                        <TabsTrigger value="monitoring">
                            <PieChart className="mr-2 h-4 w-4" />
                            Monitoramento
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="management" className="mt-6">
                         <ManageFabMessages />
                    </TabsContent>

                    <TabsContent value="idle_messages" className="mt-6">
                        <ManageIdleFabMessages />
                    </TabsContent>

                    <TabsContent value="monitoring" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Users />Seleção de Colaboradores</CardTitle>
                                <CardDescription>Selecione os colaboradores para filtrar os dados dos gráficos abaixo. Atualmente exibindo dados para {selectedUserIds.length} colaborador(es).</CardDescription>
                                <div className="relative pt-2">
                                     <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground" />
                                     <Input 
                                        placeholder="Buscar colaborador por nome, email..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                     />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[30rem]">
                                    <div className="border rounded-lg overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[50px]">
                                                        <Checkbox
                                                            checked={isAllSelected}
                                                            onCheckedChange={handleSelectAll}
                                                        />
                                                    </TableHead>
                                                    <TableHead>Nome</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <FilterableHeader fkey="area" label="Área" uniqueValues={uniqueAreas} />
                                                    <FilterableHeader fkey="position" label="Cargo" uniqueValues={uniquePositions} />
                                                    <FilterableHeader fkey="segment" label="Segmento" uniqueValues={uniqueSegments} />
                                                    <FilterableHeader fkey="leader" label="Líder" uniqueValues={uniqueLeaders} />
                                                    <FilterableHeader fkey="city" label="Cidade" uniqueValues={uniqueCities} />
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredUsers.map(user => (
                                                    <TableRow key={user.id} data-state={selectedUserIds.includes(user.id3a) ? 'selected' : ''}>
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedUserIds.includes(user.id3a)}
                                                                onCheckedChange={checked => handleSelectUser(user.id3a, !!checked)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium">{user.name}</TableCell>
                                                        <TableCell>{user.email}</TableCell>
                                                        <TableCell>{user.area}</TableCell>
                                                        <TableCell>{user.position}</TableCell>
                                                        <TableCell>{user.segment}</TableCell>
                                                        <TableCell>{user.leader}</TableCell>
                                                        <TableCell>{user.city}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <TagDistributionChart messages={selectedMessages} />
                            <CampaignStatusChart messages={selectedMessages} />
                        </div>

                        <CampaignHistoryChart messages={selectedMessages} />
                    </TabsContent>
                </Tabs>
            </div>
        </SuperAdminGuard>
    );
}

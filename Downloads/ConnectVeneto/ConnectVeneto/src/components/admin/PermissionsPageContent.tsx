
"use client";

import React, { useState, useMemo } from 'react';
import SuperAdminGuard from '@/components/auth/SuperAdminGuard';
import { useCollaborators, Collaborator, CollaboratorPermissions } from '@/contexts/CollaboratorsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Loader2, Search, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FEATURE_FLAGS } from '@/config/features';

const allPermissionLabels: { key: keyof CollaboratorPermissions; label: string; featureFlag?: keyof typeof FEATURE_FLAGS }[] = [
    { key: 'canManageSystem', label: 'Sistema' },
    { key: 'canViewAudit', label: 'Auditoria' },
    { key: 'canManageContent', label: 'Conteúdo' },
    { key: 'canViewConsultaPessoal', label: 'Consulta Pessoal' },
    { key: 'canViewDocuments', label: 'Documentos' },
    { key: 'canViewApplications', label: 'Solicitações' },
    { key: 'canViewRegrasComerciais', label: 'Regras Comerciais', featureFlag: 'regrasComerciais' },
    { key: 'canViewBI', label: 'Painéis', featureFlag: 'businessIntelligence' },
    { key: 'canViewPortalCliente', label: 'Portal do Cliente', featureFlag: 'portalCliente' },
];

const permissionLabels = allPermissionLabels.filter((item) =>
  item.featureFlag ? FEATURE_FLAGS[item.featureFlag] : true
);

function PermissionsTable() {
    const { collaborators, loading, updateCollaboratorPermissions } = useCollaborators();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ area: string[], position: string[] }>({ area: [], position: [] });

    const uniqueAreas = useMemo(() => [...new Set(collaborators.map(c => c.area))].sort(), [collaborators]);
    const uniquePositions = useMemo(() => [...new Set(collaborators.map(c => c.position))].sort(), [collaborators]);

    const filteredCollaborators = useMemo(() => {
        if (!collaborators || !Array.isArray(collaborators)) return [];
        let items = [...collaborators]
            .filter(c => c && c.name && c.email)
            .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
        
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            items = items.filter(c => 
                (c.name || '').toLowerCase().includes(lowercasedTerm) ||
                (c.email || '').toLowerCase().includes(lowercasedTerm)
            );
        }

        if (filters.area.length > 0) {
            items = items.filter(c => filters.area.includes(c.area));
        }

        if (filters.position.length > 0) {
            items = items.filter(c => filters.position.includes(c.position));
        }

        return items;
    }, [collaborators, searchTerm, filters]);

    const handlePermissionToggle = async (collaborator: Collaborator, permissionKey: keyof CollaboratorPermissions) => {
        const newPermissions = {
            ...collaborator.permissions,
            [permissionKey]: !collaborator.permissions[permissionKey],
        };
        setUpdatingId(collaborator.id);
        try {
            await updateCollaboratorPermissions(collaborator.id, newPermissions);
            toast({
                title: "Permissão Atualizada",
                description: `${collaborator.name} ${newPermissions[permissionKey] ? 'agora tem acesso a' : 'não tem mais acesso a'} '${permissionLabels.find(p => p.key === permissionKey)?.label}'.`,
            });
        } catch (error) {
            toast({
                title: "Erro ao atualizar permissão",
                description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
                variant: "destructive",
            });
        } finally {
            setUpdatingId(null);
        }
    };
    
    const handleFilterChange = (filterKey: 'area' | 'position', value: string) => {
        setFilters(prev => {
            const currentValues = prev[filterKey];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterKey]: newValues };
        });
    };
    
    const FilterableHeader = ({ fkey, label, uniqueValues }: { fkey: 'area' | 'position', label: string, uniqueValues: string[] }) => (
        <TableHead>
            <div className="flex items-center gap-2">
                <span className="flex-grow">{label}</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-60 overflow-y-auto">
                        <DropdownMenuLabel>Filtrar por {label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea>
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

    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-md">
                        <div className="space-y-2">
                           <Skeleton className="h-4 w-48" />
                           <Skeleton className="h-3 w-64" />
                        </div>
                         <div className="flex gap-4">
                            <Skeleton className="h-6 w-11" />
                            <Skeleton className="h-6 w-11" />
                            <Skeleton className="h-6 w-11" />
                            <Skeleton className="h-6 w-11" />
                            <Skeleton className="h-6 w-11" />
                            <Skeleton className="h-6 w-11" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Permissões de Administrador</CardTitle>
                        <CardDescription>
                            Ative ou desative o acesso aos painéis de controle para cada colaborador.
                        </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-x-auto max-w-full">
                    <Table className="min-w-[1400px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Colaborador</TableHead>
                                <FilterableHeader fkey="area" label="Área" uniqueValues={uniqueAreas} />
                                <FilterableHeader fkey="position" label="Cargo" uniqueValues={uniquePositions} />
                                {permissionLabels.map(p => <TableHead key={p.key}>{p.label}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCollaborators.map(collaborator => (
                                <TableRow key={collaborator.id}>
                                    <TableCell className="font-medium">{collaborator.name}<br/><span className="text-xs text-muted-foreground">{collaborator.email}</span></TableCell>
                                    <TableCell>{collaborator.area}</TableCell>
                                    <TableCell>{collaborator.position}</TableCell>
                                    {permissionLabels.map(p => (
                                        <TableCell key={p.key}>
                                            {updatingId === collaborator.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Switch
                                                    checked={!!collaborator.permissions[p.key]}
                                                    onCheckedChange={() => handlePermissionToggle(collaborator, p.key)}
                                                    disabled={updatingId === collaborator.id}
                                                    aria-label={`Ativar/desativar permissão ${p.label} para ${collaborator.name}`}
                                                    className="data-[state=checked]:bg-[hsl(170,60%,50%)]"
                                                />
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 {filteredCollaborators.length === 0 && (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">Nenhum colaborador encontrado para os filtros aplicados.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function PermissionsPageContent() {
    return (
        <SuperAdminGuard>
            <PermissionsTable />
        </SuperAdminGuard>
    );
}

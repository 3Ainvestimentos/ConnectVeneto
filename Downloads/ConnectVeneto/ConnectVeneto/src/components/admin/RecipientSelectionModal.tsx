
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { getCollaboratorUserId, type Collaborator } from '@/contexts/CollaboratorsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

type SortKey = keyof Collaborator | '';
type SortDirection = 'asc' | 'desc';
type ViewFilter = 'all' | 'selected' | 'unselected';

interface RecipientSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    allCollaborators: Collaborator[];
    selectedIds: string[];
    onConfirm: (ids: string[]) => void;
}

export function RecipientSelectionModal({
    isOpen,
    onClose,
    allCollaborators,
    selectedIds,
    onConfirm,
}: RecipientSelectionModalProps) {
    const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set(selectedIds));
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

    useEffect(() => {
        if (isOpen) {
            // If the incoming selection is ['all'], initialize the local state with all collaborator IDs.
            if (selectedIds.includes('all')) {
                setLocalSelectedIds(new Set(allCollaborators.map(c => getCollaboratorUserId(c)).filter((id): id is string => !!id)));
            } else {
                setLocalSelectedIds(new Set(selectedIds));
            }
        }
    }, [isOpen, selectedIds, allCollaborators]);
    

    const filteredAndSortedCollaborators = useMemo(() => {
        // Validar se allCollaborators existe e é um array
        if (!allCollaborators || !Array.isArray(allCollaborators)) {
            return [];
        }

        let items = allCollaborators.filter(c => {
            // Garantir que o colaborador existe e tem propriedades necessárias
            return c && typeof c === 'object' && !!getCollaboratorUserId(c);
        });
        
        if (viewFilter === 'selected') {
            items = items.filter(c => {
                const id = getCollaboratorUserId(c);
                return !!id && localSelectedIds.has(id);
            });
        } else if (viewFilter === 'unselected') {
            items = items.filter(c => {
                const id = getCollaboratorUserId(c);
                return !!id && !localSelectedIds.has(id);
            });
        }

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            items = items.filter(c => {
                const name = (c.name && typeof c.name === 'string') ? c.name.toLowerCase() : '';
                const email = (c.email && typeof c.email === 'string') ? c.email.toLowerCase() : '';
                const area = (c.area && typeof c.area === 'string') ? c.area.toLowerCase() : '';
                const position = (c.position && typeof c.position === 'string') ? c.position.toLowerCase() : '';
                return name.includes(lowerSearchTerm) || 
                       email.includes(lowerSearchTerm) || 
                       area.includes(lowerSearchTerm) || 
                       position.includes(lowerSearchTerm);
            });
        }

        if (sortKey) {
            items.sort((a, b) => {
                const valA = a[sortKey];
                const valB = b[sortKey];
                let comparison = 0;
                if (valA && valB) {
                    comparison = String(valA).localeCompare(String(valB));
                } else if (valA && !valB) {
                    comparison = 1;
                } else if (!valA && valB) {
                    comparison = -1;
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        return items;
    }, [allCollaborators, searchTerm, sortKey, sortDirection, viewFilter, localSelectedIds]);
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleSelectAllInView = (checked: boolean) => {
        if (checked) {
            const idsToAdd = filteredAndSortedCollaborators.map(c => getCollaboratorUserId(c)).filter((id): id is string => !!id);
            setLocalSelectedIds(prev => new Set([...prev, ...idsToAdd]));
        } else {
            const idsToRemove = new Set(filteredAndSortedCollaborators.map(c => getCollaboratorUserId(c)).filter((id): id is string => !!id));
            setLocalSelectedIds(prev => {
                const newSet = new Set(prev);
                idsToRemove.forEach(id => newSet.delete(id));
                return newSet;
            });
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        setLocalSelectedIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    };
    
    const handleConfirm = () => {
        // If the number of selected IDs equals the total number of collaborators,
        // it's equivalent to selecting 'all'.
        if (localSelectedIds.size === allCollaborators.length) {
            onConfirm(['all']);
        } else {
            // Otherwise, confirm with the specific list of IDs.
            onConfirm(Array.from(localSelectedIds));
        }
    };
    
    const isAllInViewSelected = useMemo(() => {
        if (filteredAndSortedCollaborators.length === 0) return false;
        return filteredAndSortedCollaborators.every(c => {
            const id = getCollaboratorUserId(c);
            return !!id && localSelectedIds.has(id);
        });
    }, [filteredAndSortedCollaborators, localSelectedIds]);
    
    const SortableHeader = ({ tkey, label }: { tkey: SortKey, label: string }) => (
        <TableHead onClick={() => handleSort(tkey)} className="cursor-pointer hover:bg-muted/50">
            {label}
            {sortKey === tkey && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />)}
        </TableHead>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Selecionar Destinatários</DialogTitle>
                </DialogHeader>
                
                <div className='flex flex-col sm:flex-row gap-2'>
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Pesquisar por nome, email, área..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
                        <SelectTrigger className='w-full sm:w-[180px]'>
                            <SelectValue placeholder="Filtrar visão..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="selected">Selecionados</SelectItem>
                            <SelectItem value="unselected">Não Selecionados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>


                <div className="flex-grow min-h-0 border rounded-lg">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={isAllInViewSelected}
                                            onCheckedChange={handleSelectAllInView}
                                            aria-label="Selecionar todos os visíveis"
                                        />
                                    </TableHead>
                                    <SortableHeader tkey="name" label="Nome" />
                                    <SortableHeader tkey="email" label="Email" />
                                    <SortableHeader tkey="area" label="Área" />
                                    <SortableHeader tkey="position" label="Cargo" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedCollaborators.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={(() => { const id = getCollaboratorUserId(c); return !!id && localSelectedIds.has(id); })()}
                                                onCheckedChange={(checked) => {
                                                    const id = getCollaboratorUserId(c);
                                                    if (id) handleSelectOne(id, !!checked);
                                                }}
                                                aria-label={`Selecionar ${c.name}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell>{c.email}</TableCell>
                                        <TableCell>{c.area}</TableCell>
                                        <TableCell>{c.position}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <div className="w-full flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                            {localSelectedIds.size} de {allCollaborators.length} selecionados
                        </p>
                        <div>
                            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button type="button" onClick={handleConfirm} className="ml-2 bg-admin-primary hover:bg-admin-primary/90">Confirmar</Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

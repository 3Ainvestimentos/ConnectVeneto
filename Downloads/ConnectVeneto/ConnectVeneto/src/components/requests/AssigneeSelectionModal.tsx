
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { getCollaboratorUserId, type Collaborator } from '@/contexts/CollaboratorsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';

type SortKey = keyof Collaborator | '';
type SortDirection = 'asc' | 'desc';

interface AssigneeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    allCollaborators: Collaborator[];
    currentAssigneeId: string | undefined;
    onConfirm: (assignee: Collaborator) => void;
}

export function AssigneeSelectionModal({
    isOpen,
    onClose,
    allCollaborators,
    currentAssigneeId,
    onConfirm,
}: AssigneeSelectionModalProps) {
    const [selectedAssignee, setSelectedAssignee] = useState<Collaborator | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    useEffect(() => {
        if (isOpen) {
            const current = allCollaborators.find(c => getCollaboratorUserId(c) === currentAssigneeId);
            setSelectedAssignee(current || null);
        }
    }, [isOpen, currentAssigneeId, allCollaborators]);

    const filteredAndSortedCollaborators = useMemo(() => {
        let items = [...allCollaborators];
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            items = items.filter(c => {
                const name = (c.name && typeof c.name === 'string') ? c.name.toLowerCase() : '';
                const email = (c.email && typeof c.email === 'string') ? c.email.toLowerCase() : '';
                const area = (c.area && typeof c.area === 'string') ? c.area.toLowerCase() : '';
                return name.includes(lowerSearchTerm) || 
                       email.includes(lowerSearchTerm) || 
                       area.includes(lowerSearchTerm);
            });
        }
        if (sortKey) {
            items.sort((a, b) => {
                const valA = a[sortKey];
                const valB = b[sortKey];
                let comparison = 0;
                if (valA && valB) {
                    comparison = String(valA).localeCompare(String(valB));
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        return items;
    }, [allCollaborators, searchTerm, sortKey, sortDirection]);
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleConfirm = () => {
        if (selectedAssignee) {
            onConfirm(selectedAssignee);
        }
    };
    
    const SortableHeader = ({ tkey, label }: { tkey: SortKey, label: string }) => (
        <TableHead onClick={() => handleSort(tkey)} className="cursor-pointer hover:bg-muted/50">
            {label}
            {sortKey === tkey && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
        </TableHead>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Selecionar Responsável</DialogTitle>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Pesquisar por nome, email, área..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex-grow min-h-0 border rounded-lg">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <SortableHeader tkey="name" label="Nome" />
                                    <SortableHeader tkey="email" label="Email" />
                                    <SortableHeader tkey="area" label="Área" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedCollaborators.map(c => (
                                    <TableRow 
                                        key={c.id} 
                                        onClick={() => setSelectedAssignee(c)}
                                        className="cursor-pointer"
                                        data-state={selectedAssignee?.id === c.id ? 'selected' : ''}
                                    >
                                        <TableCell>
                                            {selectedAssignee?.id === c.id && <UserCheck className="h-5 w-5 text-primary" />}
                                        </TableCell>
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell>{c.email}</TableCell>
                                        <TableCell>{c.area}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <div className="w-full flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                            {selectedAssignee ? `Selecionado: ${selectedAssignee.name}` : 'Ninguém selecionado'}
                        </p>
                        <div>
                            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button type="button" onClick={handleConfirm} className="ml-2 bg-admin-primary hover:bg-admin-primary/90" disabled={!selectedAssignee}>Confirmar Seleção</Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

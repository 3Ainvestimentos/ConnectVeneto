
"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCollection, WithId } from '@/lib/firestore-service';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ChangeLog {
    field: string;
    oldValue: unknown;
    newValue: unknown;
}

type LogEntry = WithId<{
    collaboratorId: string;
    collaboratorName: string;
    updatedBy: string;
    updatedAt: string;
    changes: ChangeLog[];
}>;

const LOG_COLLECTION_NAME = 'collaborator_logs';

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'vazio';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (Array.isArray(value)) {
        if (value.length === 0) return 'lista vazia';
        return value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
    }
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

const fieldLabels: { [key: string]: string } = {
    name: 'Nome',
    email: 'Email',
    axis: 'Eixo',
    area: 'Área',
    position: 'Cargo',
    segment: 'Segmento',
    leader: 'Líder',
    city: 'Cidade',
    permissions: 'Permissões',
    googleDriveLinks: 'Links do Drive',
    biLinks: 'Links de BI',
};

function ChangeDetail({ change }: { change: ChangeLog }) {
    return (
        <div className="p-2 bg-muted/50 rounded-md text-xs">
            <p><strong className="font-semibold">{fieldLabels[change.field] || change.field}:</strong></p>
            <p className="font-mono text-destructive">- {formatValue(change.oldValue)}</p>
            <p className="font-mono text-green-600">+ {formatValue(change.newValue)}</p>
        </div>
    );
}

export function CollaboratorAuditLogModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: logs, isLoading } = useQuery<LogEntry[]>({
    queryKey: [LOG_COLLECTION_NAME],
    queryFn: () => getCollection<LogEntry>(LOG_COLLECTION_NAME),
    enabled: isOpen, // Only fetch when the modal is open
    select: (data) => data.sort((a, b) => parseISO(b.updatedAt).getTime() - parseISO(a.updatedAt).getTime()),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History /> Histórico de Alterações de Colaboradores</DialogTitle>
          <DialogDescription>
            Veja o registro de todas as modificações feitas nos dados dos colaboradores.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 border rounded-lg">
            <ScrollArea className="h-full">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Modificado Por</TableHead>
                                <TableHead>Alterações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs?.map(log => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {format(parseISO(log.updatedAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                                    </TableCell>
                                    <TableCell className="font-medium">{log.collaboratorName}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{log.updatedBy}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-2">
                                            {log.changes.map((change, index) => <ChangeDetail key={index} change={change} />)}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
                {!isLoading && (!logs || logs.length === 0) && (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>Nenhum log de alteração encontrado.</p>
                    </div>
                )}
            </ScrollArea>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, GripVertical, ListOrdered } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWorkflowAreas, WorkflowArea } from '@/contexts/WorkflowAreasContext';
import { WorkflowDefinition } from '@/contexts/ApplicationsContext';
import { Card, CardContent } from '../ui/card';
import { getIcon } from '@/lib/icons';
import { ScrollArea } from '../ui/scroll-area';

interface OrderWorkflowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: WorkflowArea;
  allWorkflows: WorkflowDefinition[];
}

export function OrderWorkflowsModal({ isOpen, onClose, area, allWorkflows }: OrderWorkflowsModalProps) {
  const [orderedWorkflows, setOrderedWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { updateWorkflowArea } = useWorkflowAreas();

  useEffect(() => {
    if (area) {
      const workflowsInArea = allWorkflows.filter(wf => wf.areaId === area.id);
      
      const sorted = [...workflowsInArea].sort((a, b) => {
        const orderA = area.workflowOrder?.indexOf(a.id) ?? -1;
        const orderB = area.workflowOrder?.indexOf(b.id) ?? -1;
        
        if (orderA !== -1 && orderB !== -1) {
            return orderA - orderB;
        }
        if (orderA !== -1) return -1;
        if (orderB !== -1) return 1;

        return a.name.localeCompare(b.name);
      });
      setOrderedWorkflows(sorted);
    }
  }, [area, allWorkflows]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const items = Array.from(orderedWorkflows);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrderedWorkflows(items);
  };

  const handleSaveOrder = async () => {
    setIsSaving(true);
    try {
      const newOrder = orderedWorkflows.map(wf => wf.id);
      await updateWorkflowArea({ id: area.id, workflowOrder: newOrder });
      toast({ title: "Sucesso", description: "A ordem dos workflows foi salva." });
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar a nova ordem.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!area) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListOrdered/> Ordenar Workflows</DialogTitle>
          <DialogDescription>
            Arraste e solte para reordenar os workflows na área &quot;{area.name}&quot;. A ordem aqui definida será refletida na tela de solicitações.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
            <div className="py-4 pr-4">
                <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="workflows">
                    {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {orderedWorkflows.map((workflow, index) => {
                          const Icon = getIcon(workflow.icon);
                          return (
                            <Draggable key={workflow.id} draggableId={workflow.id} index={index}>
                                {(provided) => (
                                <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="hover:bg-muted/50"
                                >
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        <Icon className="h-5 w-5 text-muted-foreground" />
                                        <p className="flex-grow font-medium text-sm">{workflow.name}</p>
                                    </CardContent>
                                </Card>
                                )}
                            </Draggable>
                        )})}
                        {provided.placeholder}
                    </div>
                    )}
                </Droppable>
                </DragDropContext>
            </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSaving}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSaveOrder} disabled={isSaving} className="bg-admin-primary hover:bg-admin-primary/90">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Salvar Ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

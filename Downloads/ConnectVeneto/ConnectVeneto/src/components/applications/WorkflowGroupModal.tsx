"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkflowDefinition } from '@/contexts/ApplicationsContext';
import { getIcon } from '@/lib/icons';

// Constante para o ID da área de TI
const TI_AREA_ID = "3i5eo3hPQrfWcAtfPkBt";
const TI_IFRAME_URL = "https://forms.office.com/Pages/ResponsePage.aspx?id=ACXbfB7NAUCLvGYkkS8Uk6oQv2As8jlDucbCbOVTtO9UQzNVMDJHMURUQURJTVVZVjAzSUs2T0ROWSQlQCN0PWcu&embed=true";

interface WorkflowGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaName: string;
  group: WorkflowDefinition[];
  onWorkflowSelect: (workflow: WorkflowDefinition) => void;
}

export function WorkflowGroupModal({ open, onOpenChange, areaName, group, onWorkflowSelect }: WorkflowGroupModalProps) {
  if (!group || group.length === 0) return null;

  // Verifica se é a área de TI - todos os workflows do grupo têm o mesmo areaId
  const isTIArea = group[0]?.areaId === TI_AREA_ID;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isTIArea ? "sm:max-w-4xl max-h-[90vh]" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{areaName}</DialogTitle>
          <DialogDescription>
            {isTIArea 
              ? "Preencha o formulário abaixo para iniciar uma nova solicitação."
              : "Selecione um dos processos abaixo para iniciar uma nova solicitação."
            }
          </DialogDescription>
        </DialogHeader>
        
        {isTIArea ? (
          // Renderiza iframe para TI
          <div className="w-full h-[70vh] min-h-[600px]">
            <iframe
              src={TI_IFRAME_URL}
              width="100%"
              height="100%"
              frameBorder="0"
              marginWidth={0}
              marginHeight={0}
              style={{ border: 'none', maxWidth: '100%', maxHeight: '100%' }}
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ) : (
          // Renderiza cards normais para outras áreas
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3 py-4">
              {group.map((workflow) => {
                const Icon = getIcon(workflow.icon);
                return (
                  <Card
                    key={workflow.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onWorkflowSelect(workflow)}
                    onKeyDown={(e) => e.key === 'Enter' && onWorkflowSelect(workflow)}
                    tabIndex={0}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <Icon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                      <div className="flex-grow">
                        <p className="font-semibold font-body text-sm text-card-foreground">{workflow.name}</p>
                        {workflow.subtitle && (
                          <p className="text-xs text-muted-foreground">{workflow.subtitle}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
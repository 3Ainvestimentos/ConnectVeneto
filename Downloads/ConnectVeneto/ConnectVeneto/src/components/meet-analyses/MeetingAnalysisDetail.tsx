
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MeetingAnalysis, Opportunity } from '@/contexts/MeetingAnalysesContext';

interface MeetingAnalysisDetailProps {
  analysis: MeetingAnalysis;
}

type DateLike = {
  toDate: () => Date;
};

// Função helper para obter a data mais apropriada para exibição
// Prioriza: assessment_completed_at > created_at > updated_at
const getDisplayDate = (analysis: MeetingAnalysis): string | DateLike | undefined => {
  return analysis.assessment_completed_at || analysis.created_at || analysis.updated_at;
};

const priorityColors = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

const priorityLabels = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export default function MeetingAnalysisDetail({ analysis }: MeetingAnalysisDetailProps) {
  const formatDate = (date: string | DateLike | undefined): string => {
    try {
      const parsedDate = typeof date === 'string' ? parseISO(date) : date?.toDate();
      if (!parsedDate || !isValid(parsedDate)) return 'Data inválida';
      return format(parsedDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const formatParticipants = (participants: MeetingAnalysis['participants']): string => {
    return participants.map(p => p.name).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header com informações primárias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{analysis.file_name}</CardTitle>
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Data:</span> {formatDate(getDisplayDate(analysis))}
            </div>
            <div>
              <span className="font-medium text-foreground">Participantes:</span> {formatParticipants(analysis.participants)}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo da Reunião</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.summary}</p>
        </CardContent>
      </Card>

      {/* Opportunities em sanfona hierárquica */}
      {analysis.opportunities && analysis.opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Oportunidades Identificadas</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {analysis.opportunities.map((opportunity, index) => (
                <OpportunityAccordionItem
                  key={index}
                  opportunity={opportunity}
                  index={index}
                />
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface OpportunityAccordionItemProps {
  opportunity: Opportunity;
  index: number;
}

function OpportunityAccordionItem({ opportunity, index }: OpportunityAccordionItemProps) {
  const titleId = `opportunity-title-${index}`;

  // Função helper para obter as menções (compatível com pré e pós-migração)
  const getMentions = (): string[] => {
    // Prioriza clientMentions (novo), mas usa mentions (antigo) como fallback
    return opportunity.clientMentions || opportunity.mentions || [];
  };

  const mentions = getMentions();

  return (
    <AccordionItem value={titleId} className="border-b">
      {/* Nível 1: Title - ao expandir mostra descrição diretamente */}
      <AccordionTrigger className="py-4">
        <div className="flex items-center justify-between w-full pr-4">
          <span className="font-semibold text-left">{opportunity.title}</span>
          <Badge
            variant="outline"
            className={priorityColors[opportunity.priority]}
          >
            {priorityLabels[opportunity.priority]}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {/* Descrição mostrada diretamente na primeira expansão */}
        <div className="ml-4">
          <p className="text-sm font-medium mb-2 text-foreground">Descrição:</p>
          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">
            {opportunity.description}
          </p>
          
          {/* Nível 2: Mentions (sanfona para menções) - compatível com mentions e clientMentions */}
          {mentions.length > 0 && (
            <div className="mt-4">
              <Accordion type="single" collapsible>
                <AccordionItem value={`mentions-${index}`} className="border-0">
                  <AccordionTrigger className="py-2 text-xs font-medium">
                    Menções ({mentions.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc list-inside space-y-2 text-xs text-muted-foreground ml-2">
                      {mentions.map((mention, mentionIndex) => (
                        <li key={mentionIndex} className="leading-relaxed">
                          &quot;{mention}&quot;
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

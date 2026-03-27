
"use client";

import React, { useState, useMemo } from 'react';
import { useMeetingAnalyses } from '@/contexts/MeetingAnalysesContext';
import { Input } from '@/components/ui/input';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Calendar } from 'lucide-react';
import { format, parseISO, isValid, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { Skeleton } from '@/components/ui/skeleton';
import type { MeetingAnalysis } from '@/contexts/MeetingAnalysesContext';

type DateLike = {
  toDate: () => Date;
};

// Função helper para obter a data mais apropriada para exibição
// Prioriza: assessment_completed_at > created_at > updated_at
const getDisplayDate = (analysis: MeetingAnalysis): string | DateLike | undefined => {
  return analysis.assessment_completed_at || analysis.created_at || analysis.updated_at;
};

export default function MeetingAnalysesList() {
  const { meetingAnalyses, loading } = useMeetingAnalyses();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const filteredAnalyses = useMemo(() => {
    let filtered = [...meetingAnalyses];

    // Filtro por busca de participantes
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(analysis => {
        return analysis.participants.some(participant =>
          participant.name.toLowerCase().includes(lowerSearchTerm)
        );
      });
    }

    // Filtro por data (usa a data de exibição)
    if (dateRange?.from && dateRange?.to) {
      const from = startOfDay(dateRange.from);
      const to = endOfDay(dateRange.to);
      
      filtered = filtered.filter(analysis => {
        const displayDate = getDisplayDate(analysis);
        const date = typeof displayDate === 'string' 
          ? parseISO(displayDate) 
          : displayDate?.toDate();
        
        if (!date || !isValid(date)) return false;
        return isWithinInterval(date, { start: from, end: to });
      });
    }

    // Ordenar por data mais recente primeiro (usa a data de exibição)
    filtered.sort((a, b) => {
      const displayDateA = getDisplayDate(a);
      const displayDateB = getDisplayDate(b);
      const dateA = typeof displayDateA === 'string' 
        ? parseISO(displayDateA) 
        : displayDateA?.toDate();
      const dateB = typeof displayDateB === 'string' 
        ? parseISO(displayDateB) 
        : displayDateB?.toDate();
      
      if (!dateA || !isValid(dateA)) return 1;
      if (!dateB || !isValid(dateB)) return -1;
      
      return dateB.getTime() - dateA.getTime();
    });

    return filtered;
  }, [meetingAnalyses, searchTerm, dateRange]);

  const handleAnalysisClick = (analysisId: string) => {
    // Codificar o ID para URL (importante para IDs com caracteres especiais)
    const encodedId = encodeURIComponent(analysisId);
    router.push(`/meet-analyses/${encodedId}`);
  };

  const formatDate = (date: string | DateLike | undefined): string => {
    try {
      const parsedDate = typeof date === 'string' ? parseISO(date) : date?.toDate();
      if (!parsedDate || !isValid(parsedDate)) return 'Data inválida';
      return format(parsedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const formatParticipants = (participants: MeetingAnalysis['participants']): string => {
    return participants.map(p => p.name).join(', ');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-[300px]" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (meetingAnalyses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma análise encontrada</h3>
          <p className="text-muted-foreground text-center">
            Você ainda não possui análises de reuniões disponíveis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por participantes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <DatePickerWithRange
          date={dateRange}
          onDateChange={setDateRange}
        />
      </div>

      {/* Lista de análises */}
      {filteredAnalyses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum resultado encontrado</h3>
            <p className="text-muted-foreground text-center">
              Tente ajustar os filtros de busca ou data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {filteredAnalyses.map((analysis) => (
            <Card key={analysis.id} className="overflow-hidden">
              <AccordionItem value={analysis.id} className="border-0">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 text-left">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base mb-1">{analysis.file_name}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(getDisplayDate(analysis))}</span>
                        <span>{formatParticipants(analysis.participants)}</span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div 
                    className="text-sm text-muted-foreground cursor-pointer"
                    onClick={() => handleAnalysisClick(analysis.id)}
                  >
                    <p className="font-medium mb-2 text-foreground">Resumo:</p>
                    <p className="line-clamp-3">{analysis.summary}</p>
                    <p className="text-xs mt-2 text-primary hover:underline">Clique para ver detalhes completos →</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Card>
          ))}
        </Accordion>
      )}
    </div>
  );
}

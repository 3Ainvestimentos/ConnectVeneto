"use client";

import { useQuery } from '@tanstack/react-query';
import { endOfDay, startOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import type { CalendarItem } from '@/lib/calendar/types';

/**
 * Eventos do Google Agenda da Vêneto (`/api/calendar`) numa janela. Falha (sem configuração no
 * servidor, sem rede, sem permissão) vira lista vazia: na Home a agenda da empresa é complemento.
 */
export function useCompanyCalendar(from: Date, to: Date) {
  const { user } = useAuth();
  // Dia inteiro nas pontas: a chave do cache não muda a cada render (o chamador pode passar `new Date()`).
  const timeMin = startOfDay(from).toISOString();
  const timeMax = endOfDay(to).toISOString();
  return useQuery({
    queryKey: ['company-calendar', timeMin, timeMax],
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CalendarItem[]> => {
      try {
        const token = await user?.getIdToken();
        const res = await fetch(`/api/calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return [];
        const payload = await res.json().catch(() => ({}));
        return Array.isArray(payload.items) ? payload.items : [];
      } catch {
        return [];
      }
    },
  });
}

"use client";

import { useCallback, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';
import type { CommercialFileType } from '@/config/biblioteca-comercial';

export type AssistantSuggestion = {
  title: string;
  description: string;
  tags: string[];
};

type AssistantResponse =
  | { status: 'questions'; questions: string[] }
  | ({ status: 'final' } & AssistantSuggestion);

export type AssistantAnswer = { question: string; answer: string };

type AskInput = {
  fileName: string;
  fileType: CommercialFileType;
  userDescription: string;
  answers: AssistantAnswer[];
  round: number;
  /** "Pular perguntas": encerra a entrevista e devolve os metadados já nesta chamada. */
  finalize?: boolean;
};

/**
 * Entrevista de catalogação: manda o contexto para /api/biblioteca-comercial/assistant
 * e recebe ou perguntas de acompanhamento, ou os metadados finais sugeridos.
 */
export function useUploadAssistant() {
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (input: AskInput): Promise<AssistantResponse | null> => {
    setIsThinking(true);
    setError(null);
    try {
      const currentUser = getAuth(getFirebaseApp()).currentUser;
      if (!currentUser) throw new Error('Sessão expirada. Entre novamente para continuar.');

      const token = await currentUser.getIdToken();
      const response = await fetch('/api/biblioteca-comercial/assistant', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AssistantResponse & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? 'O assistente não respondeu.');
      }

      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'O assistente não respondeu.');
      return null;
    } finally {
      setIsThinking(false);
    }
  }, []);

  return { ask, isThinking, error };
}

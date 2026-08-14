"use client";

import { useCallback, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';
import type { CommercialFileType } from '@/config/biblioteca-comercial';
import { extractDocumentText, type ExtractionResult } from '@/lib/document-text-extraction';

export type AssistantSuggestion = {
  title: string;
  description: string;
  tags: string[];
};

export type AssistantQuestion = {
  question: string;
  /** Resposta deduzida do conteúdo do arquivo; vazia quando não deu para deduzir. */
  suggestedAnswer: string;
};

type AssistantResponse =
  | { status: 'questions'; questions: AssistantQuestion[] }
  | ({ status: 'final' } & AssistantSuggestion);

export type AssistantAnswer = { question: string; answer: string };

type AskInput = {
  fileName: string;
  fileType: CommercialFileType;
  userDescription: string;
  /** Conteúdo lido do arquivo, para o assistente catalogar pelo que está escrito. */
  documentText?: string;
  answers: AssistantAnswer[];
  round: number;
  /** "Pular perguntas": encerra a entrevista e devolve os metadados já nesta chamada. */
  finalize?: boolean;
};

async function getIdToken(): Promise<string> {
  const currentUser = getAuth(getFirebaseApp()).currentUser;
  if (!currentUser) throw new Error('Sessão expirada. Entre novamente para continuar.');
  return currentUser.getIdToken();
}

/**
 * Assistente de catalogação: lê o conteúdo do arquivo, redige o rascunho da
 * descrição e conduz a entrevista curta que gera os metadados finais.
 */
export function useUploadAssistant() {
  const [isThinking, setIsThinking] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Lê o arquivo e já devolve um rascunho de descrição.
   *
   * Nunca lança: se a leitura ou o rascunho falharem, devolve o motivo em `note`
   * e o cadastro segue com preenchimento manual.
   */
  const readFile = useCallback(
    async (
      file: File,
      fileType: CommercialFileType
    ): Promise<{ extraction: ExtractionResult; draftDescription: string }> => {
      setIsReadingFile(true);
      setError(null);
      try {
        const token = await getIdToken();
        const extraction = await extractDocumentText(file, token);

        if (!extraction.text) {
          return { extraction, draftDescription: '' };
        }

        const response = await fetch('/api/biblioteca-comercial/draft', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileType,
            documentText: extraction.text,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { description?: string; error?: string }
          | null;

        if (!response.ok || !payload?.description) {
          return {
            extraction: {
              ...extraction,
              note: payload?.error ?? 'Li o arquivo, mas não consegui redigir a descrição.',
            },
            draftDescription: '',
          };
        }

        return { extraction, draftDescription: payload.description };
      } catch (caught) {
        return {
          extraction: {
            text: '',
            source: 'none',
            note: caught instanceof Error ? caught.message : 'Não consegui ler o arquivo.',
          },
          draftDescription: '',
        };
      } finally {
        setIsReadingFile(false);
      }
    },
    []
  );

  const ask = useCallback(async (input: AskInput): Promise<AssistantResponse | null> => {
    setIsThinking(true);
    setError(null);
    try {
      const token = await getIdToken();
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

  return { ask, readFile, isThinking, isReadingFile, error };
}

import { NextResponse } from 'next/server';
import {
  logSecurityEvent,
  requireBibliotecaComercialManager,
  securityErrorResponse,
} from '@/lib/security';
import { getOpenAIClient, isOpenAIConfigured } from '@/lib/openai';

/** O body da Vercel não passa de ~4,5 MB; o client manda só um trecho do áudio. */
const MAX_AUDIO_BYTES = 4.5 * 1024 * 1024;

/** Só o começo já basta para descrever o material; o resto é custo à toa. */
const MAX_TRANSCRIPT_CHARS = 8000;

const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'];

/**
 * Transcreve um trecho de áudio para o assistente de catalogação conseguir
 * descrever podcasts a partir do que é dito, não só do nome do arquivo.
 *
 * Recebe o arquivo direto (multipart), e não um caminho no Storage: a leitura
 * acontece antes do upload, enquanto quem publica ainda está preenchendo o
 * cadastro — e um cadastro abandonado não deixa arquivo órfão.
 */
export async function POST(request: Request) {
  try {
    const context = await requireBibliotecaComercialManager(request.headers.get('Authorization'));

    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        { error: 'Transcrição indisponível: OPENAI_API_KEY não configurada.' },
        { status: 503 }
      );
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Envie o arquivo de áudio.' }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Trecho de áudio grande demais.' }, { status: 413 });
    }

    if (file.type && !ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de áudio não suportado.' }, { status: 400 });
    }

    const openai = getOpenAIClient();
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
    });

    const text = (transcription.text ?? '').slice(0, MAX_TRANSCRIPT_CHARS);

    logSecurityEvent('[api/biblioteca-comercial/transcribe] audio transcrito', {
      email: context.email,
      bytes: file.size,
      chars: text.length,
    });

    return NextResponse.json({ text }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/biblioteca-comercial/transcribe] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    logSecurityEvent('[api/biblioteca-comercial/transcribe] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    // Transcrição é um extra: o cadastro segue sem ela.
    return NextResponse.json({ error: 'Não consegui transcrever este áudio.' }, { status: 500 });
  }
}

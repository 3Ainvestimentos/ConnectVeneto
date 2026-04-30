import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  OutboundHttpError,
  RequestValidationError,
  logSecurityEvent,
  requireCorporateUser,
  safeFetch,
  securityErrorResponse,
  validateSearchParams,
} from '@/lib/security';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

const calendarQuerySchema = z.object({
  timeMin: z.string().min(1, 'Parâmetros timeMin e timeMax são obrigatórios (ISO 8601).'),
  timeMax: z.string().min(1, 'Parâmetros timeMin e timeMax são obrigatórios (ISO 8601).'),
});

function normalizeCalendarId(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  const embed = value.match(
    /calendar\.google\.com\/calendar\/(?:u\/\d+\/)?embed\?src=([^&\s#]+)/i
  );

  if (embed?.[1]) {
    try {
      return decodeURIComponent(embed[1].replace(/\+/g, ' '));
    } catch {
      return embed[1];
    }
  }

  return value;
}

function buildCalendarHint(status: number, googleMessage: string): string | undefined {
  if (status !== 403 && status !== 404) {
    return googleMessage ? `Google: ${googleMessage}` : undefined;
  }

  const lower = googleMessage.toLowerCase();
  const referrerBlocked =
    lower.includes('referer') ||
    lower.includes('referrer') ||
    lower.includes('not allowed for use') ||
    lower.includes('ip address');

  if (status === 404 && !referrerBlocked) {
    return '404 Not Found: o Google não encontrou este calendário com a chave de API. Confira o CALENDAR_PUBLIC_ID, visibilidade pública do calendário e a configuração da chave.';
  }

  if (referrerBlocked) {
    return 'A chave da Google Calendar API está bloqueada para esta chamada. Verifique restrições de uso e habilitação da API.';
  }

  return 'Confirme se o calendário está público, se o CALENDAR_PUBLIC_ID está correto e se a Google Calendar API está habilitada.';
}

export async function GET(request: Request) {
  try {
    await requireCorporateUser(request.headers.get('Authorization'));

    const calendarId = normalizeCalendarId(process.env.CALENDAR_PUBLIC_ID ?? '');

    // Usar APENAS a chave dedicada para a Calendar API.
    // O fallback para NEXT_PUBLIC_FIREBASE_API_KEY foi removido: essa chave tem escopo
    // diferente (Firebase Web SDK) e misturar os dois cria ambiguidade de permissões.
    // Se GOOGLE_CALENDAR_API_KEY não estiver configurada, falhar explicitamente.
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY?.trim();

    if (!calendarId) {
      return NextResponse.json(
        { error: 'CALENDAR_PUBLIC_ID não configurado no servidor.' },
        { status: 503 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_CALENDAR_API_KEY não configurada. Configure a variável de ambiente no servidor.' },
        { status: 503 }
      );
    }

    const { timeMin, timeMax } = validateSearchParams(request.url, calendarQuerySchema);

    const url = new URL(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set('key', apiKey);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const response = await safeFetch(url.toString(), {
      allowedHosts: ['www.googleapis.com'],
      headers: { Accept: 'application/json' },
      timeoutMs: 5000,
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      const body = await response.text();

      let googleMessage = '';
      try {
        const errJson = JSON.parse(body) as {
          error?: { message?: string; errors?: { message?: string }[] };
        };
        googleMessage =
          (errJson.error?.errors?.[0]?.message || errJson.error?.message || '').trim();
      } catch {
        googleMessage = '';
      }

      const hint = buildCalendarHint(response.status, googleMessage);
      logSecurityEvent('[api/calendar] upstream error', {
        status: response.status,
        hint,
      });

      return NextResponse.json(
        {
          error: 'Não foi possível carregar a agenda.',
          hint,
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { items?: unknown[] };
    return NextResponse.json({ items: data.items ?? [] });
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/calendar] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { error: 'Parâmetros timeMin e timeMax são obrigatórios (ISO 8601).' },
        { status: error.status }
      );
    }

    if (error instanceof OutboundHttpError) {
      logSecurityEvent('[api/calendar] outbound error', {
        error: error.message,
        status: error.status,
      });
      return NextResponse.json({ error: 'Não foi possível carregar a agenda.' }, { status: 502 });
    }

    logSecurityEvent('[api/calendar] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Não foi possível carregar a agenda.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { verifyCorporateRequest } from '@/lib/api-auth';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/** Remove aspas, espaços e extrai o ID se colarem URL de incorporação do Google Calendar. */
function normalizeCalendarId(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  const embed = s.match(
    /calendar\.google\.com\/calendar\/(?:u\/\d+\/)?embed\?src=([^&\s#]+)/i
  );
  if (embed?.[1]) {
    try {
      return decodeURIComponent(embed[1].replace(/\+/g, ' '));
    } catch {
      return embed[1];
    }
  }
  return s;
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    await verifyCorporateRequest(authorizationHeader);

    const calendarId = normalizeCalendarId(process.env.CALENDAR_PUBLIC_ID ?? '');
    const apiKey =
      process.env.GOOGLE_CALENDAR_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();

    if (!calendarId) {
      return NextResponse.json(
        { error: 'CALENDAR_PUBLIC_ID não configurado no servidor.' },
        { status: 503 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_CALENDAR_API_KEY ou NEXT_PUBLIC_FIREBASE_API_KEY não configurada.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: 'Parâmetros timeMin e timeMax são obrigatórios (ISO 8601).' },
        { status: 400 }
      );
    }

    const url = new URL(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set('key', apiKey);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const gRes = await fetch(url.toString(), {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });

    if (!gRes.ok) {
      const body = await gRes.text();
      console.error('[api/calendar] Google Calendar API', gRes.status, body.slice(0, 500));

      let googleMessage = '';
      try {
        const errJson = JSON.parse(body) as {
          error?: { message?: string; errors?: { message?: string }[] };
        };
        googleMessage =
          (errJson.error?.errors?.[0]?.message || errJson.error?.message || '').trim();
      } catch {
        /* ignore */
      }

      let hint: string | undefined;
      if (gRes.status === 403 || gRes.status === 404) {
        const lower = googleMessage.toLowerCase();
        const referrerBlocked =
          lower.includes('referer') ||
          lower.includes('referrer') ||
          lower.includes('not allowed for use') ||
          lower.includes('ip address');

        if (gRes.status === 404 && !referrerBlocked) {
          hint =
            '404 Not Found: o Google não encontrou este calendário com a chave de API. No Google Calendar, abra o calendário → Configurações e compartilhamento → copie o "ID do calendário" em Integrar calendário e use em CALENDAR_PUBLIC_ID. Em "Permissões de acesso aos eventos", ative "Disponibilizar para público" (senão a API com chave não enxerga o calendário).';
        } else {
          hint = referrerBlocked
            ? 'A chave usada no servidor está bloqueada para esta chamada (restrição de sites/IP). Crie no Google Cloud uma chave só para a Google Calendar API, sem restrição de sites HTTP, defina GOOGLE_CALENDAR_API_KEY no .env e na Vercel, e habilite a API no mesmo projeto.'
            : 'Confirme que o calendário está público, o CALENDAR_PUBLIC_ID está correto e a Google Calendar API está habilitada no projeto da chave.';
        }

        if (googleMessage && !referrerBlocked && gRes.status !== 404) {
          hint = `${hint} (Google: ${googleMessage})`;
        } else if (googleMessage && gRes.status === 404 && referrerBlocked) {
          hint = `${hint} (Google: ${googleMessage})`;
        }
      } else if (googleMessage) {
        hint = `Google: ${googleMessage}`;
      }

      return NextResponse.json(
        {
          error: 'Não foi possível carregar a agenda.',
          hint,
        },
        { status: 502 }
      );
    }

    const data = (await gRes.json()) as { items?: unknown[] };
    return NextResponse.json({ items: data.items ?? [] });
  } catch (error) {
    if (
      (error as Error)?.message === 'UNAUTHORIZED_MISSING_TOKEN' ||
      (error as Error)?.message === 'UNAUTHORIZED_INVALID_TOKEN'
    ) {
      return NextResponse.json({ error: 'Nao autorizado: token nao fornecido.' }, { status: 401 });
    }

    if ((error as Error)?.message === 'FORBIDDEN_NON_CORPORATE_EMAIL') {
      return NextResponse.json(
        { error: 'Acesso negado: apenas contas corporativas podem acessar.' },
        { status: 403 }
      );
    }

    console.error('Error in /api/calendar:', error);
    return NextResponse.json({ error: 'Não foi possível carregar a agenda.' }, { status: 500 });
  }
}

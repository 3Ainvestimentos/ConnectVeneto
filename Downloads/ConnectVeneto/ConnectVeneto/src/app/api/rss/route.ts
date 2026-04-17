import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
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

interface CustomFeedItem extends Parser.Item {
  sourceCategory?: string;
  'content:encoded'?: string;
}

const MAX_FEED_URLS = 5;
const MAX_FEED_BODY_BYTES = 2 * 1024 * 1024; // 2 MB por feed, corta DoS via upstream inflado.
const FEED_FETCH_TIMEOUT_MS = 6000;
const ALLOWED_RSS_HOSTS = ['www.infomoney.com.br'];

const rssQuerySchema = z.object({
  urls: z.string({
    required_error: 'Nenhuma URL de feed fornecida.',
    invalid_type_error: 'Nenhuma URL de feed fornecida.',
  }).min(1, 'Nenhuma URL de feed fornecida.'),
});

const getCategoryFromUrl = (url: string): string => {
  if (url.includes('mercados')) return 'Mercados';
  if (url.includes('economia')) return 'Economia';
  if (url.includes('business')) return 'Business';
  if (url.includes('mundo')) return 'Mundo';
  return 'Notícias';
};

const isAllowedFeedUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_RSS_HOSTS.includes(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
};

const isAcceptableFeedContentType = (contentType: string | null): boolean => {
  if (!contentType) return true; // upstream as vezes omite; confiamos na allowlist.
  const lower = contentType.toLowerCase();
  return (
    lower.includes('xml') ||
    lower.includes('rss') ||
    lower.includes('atom') ||
    lower.includes('text/plain')
  );
};

/**
 * Busca um feed RSS passando pela camada segura (`safeFetch`) com:
 * - allowlist de hosts
 * - timeout
 * - limite de body (2 MB)
 * - validacao de content-type
 *
 * Retorna o texto XML ja seguro para `parser.parseString`.
 */
async function fetchFeedText(feedUrl: string): Promise<string> {
  const response = await safeFetch(feedUrl, {
    allowedHosts: ALLOWED_RSS_HOSTS,
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
      'User-Agent': 'ConnectVeneto-RSS/1.0',
    },
    timeoutMs: FEED_FETCH_TIMEOUT_MS,
  });

  if (!response.ok) {
    throw new OutboundHttpError(`Feed RSS retornou status ${response.status}.`);
  }

  if (!isAcceptableFeedContentType(response.headers.get('content-type'))) {
    throw new OutboundHttpError('Content-type inesperado para feed RSS.');
  }

  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_FEED_BODY_BYTES) {
    throw new OutboundHttpError('Feed RSS acima do limite permitido.');
  }

  const text = await response.text();
  if (text.length > MAX_FEED_BODY_BYTES) {
    throw new OutboundHttpError('Feed RSS acima do limite permitido.');
  }

  return text;
}

export async function GET(request: Request) {
  try {
    await requireCorporateUser(request.headers.get('Authorization'));

    const { urls } = validateSearchParams(request.url, rssQuerySchema);

    const feedUrls = urls
      .split(',')
      .map((url) => decodeURIComponent(url).trim())
      .filter(Boolean);

    if (feedUrls.length === 0 || feedUrls.length > MAX_FEED_URLS) {
      throw new RequestValidationError(
        `Quantidade de URLs invalida. Envie entre 1 e ${MAX_FEED_URLS} URLs.`
      );
    }

    const invalidUrl = feedUrls.find((url) => !isAllowedFeedUrl(url));
    if (invalidUrl) {
      return NextResponse.json(
        { error: 'URL de feed nao permitida. Apenas dominios whitelisted podem ser consultados.' },
        { status: 403 }
      );
    }

    const parser = new Parser({
      customFields: {
        item: ['content:encoded', 'enclosure'],
      },
    });

    let combinedItems: CustomFeedItem[] = [];
    let firstFeedTitle = 'Feed de Notícias';

    for (const feedUrl of feedUrls) {
      const xmlText = await fetchFeedText(feedUrl);
      const feed = await parser.parseString(xmlText);
      const category = getCategoryFromUrl(feedUrl);

      if (feed.title && firstFeedTitle === 'Feed de Notícias') {
        firstFeedTitle = feed.title;
      }

      if (feed.items?.length) {
        const normalizedItems = feed.items.map((item) => ({
          ...item,
          content: item['content:encoded'] || item.content,
          sourceCategory: category,
        }));
        combinedItems = combinedItems.concat(normalizedItems);
      }
    }

    if (combinedItems.length === 0) {
      return NextResponse.json({
        title: firstFeedTitle,
        items: [],
      });
    }

    combinedItems.sort((a, b) => {
      const dateA = a.isoDate ? new Date(a.isoDate).getTime() : 0;
      const dateB = b.isoDate ? new Date(b.isoDate).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      title: firstFeedTitle,
      items: combinedItems.slice(0, 10),
    });
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent('[api/rss] security error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return knownSecurityError;
    }

    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof OutboundHttpError) {
      logSecurityEvent('[api/rss] outbound error', {
        error: error.message,
        status: error.status,
      });
      return NextResponse.json(
        { error: 'Não foi possível carregar os feeds.' },
        { status: 502 }
      );
    }

    logSecurityEvent('[api/rss] unexpected error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Não foi possível carregar os feeds.' }, { status: 500 });
  }
}

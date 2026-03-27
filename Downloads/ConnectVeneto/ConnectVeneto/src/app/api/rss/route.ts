
// src/app/api/rss/route.ts
import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { verifyCorporateRequest } from '@/lib/api-auth';

interface CustomFeedItem extends Parser.Item {
  sourceCategory?: string;
  'content:encoded'?: string;
}

const getCategoryFromUrl = (url: string): string => {
    if (url.includes('mercados')) return 'Mercados';
    if (url.includes('economia')) return 'Economia';
    if (url.includes('business')) return 'Business';
    if (url.includes('mundo')) return 'Mundo';
    return 'Notícias';
};

const MAX_FEED_URLS = 5;
const ALLOWED_RSS_HOSTS = new Set([
  'infomoney.com.br',
  'www.infomoney.com.br',
]);

const isAllowedFeedUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_RSS_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    await verifyCorporateRequest(authorizationHeader);

    const { searchParams } = new URL(request.url);
    const feedUrlsParam = searchParams.get('urls');

    if (!feedUrlsParam) {
      return NextResponse.json({ error: 'Nenhuma URL de feed fornecida.' }, { status: 400 });
    }

    const feedUrls = feedUrlsParam
      .split(',')
      .map((url) => decodeURIComponent(url).trim())
      .filter(Boolean);

    if (feedUrls.length === 0 || feedUrls.length > MAX_FEED_URLS) {
      return NextResponse.json(
        { error: `Quantidade de URLs invalida. Envie entre 1 e ${MAX_FEED_URLS} URLs.` },
        { status: 400 }
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
            item: ['content:encoded', 'enclosure']
        }
    });

    let combinedItems: CustomFeedItem[] = [];
    let firstFeedTitle = 'Feed de Notícias';

    for (const feedUrl of feedUrls) {
      const feed = await parser.parseURL(feedUrl);
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
    
    const finalItems = combinedItems.slice(0, 10);

    return NextResponse.json({
        title: firstFeedTitle,
        items: finalItems
    });
  } catch (error) {
    if ((error as Error)?.message === 'UNAUTHORIZED_MISSING_TOKEN' || (error as Error)?.message === 'UNAUTHORIZED_INVALID_TOKEN') {
      return NextResponse.json({ error: 'Nao autorizado: token nao fornecido.' }, { status: 401 });
    }

    if ((error as Error)?.message === 'FORBIDDEN_NON_CORPORATE_EMAIL') {
      return NextResponse.json({ error: 'Acesso negado: apenas contas corporativas podem acessar.' }, { status: 403 });
    }

    console.error("Error in /api/rss:", error);
    return NextResponse.json({ error: 'Não foi possível carregar os feeds.' }, { status: 500 });
  }
}

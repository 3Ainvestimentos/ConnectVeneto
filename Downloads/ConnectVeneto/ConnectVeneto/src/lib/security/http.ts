type SafeFetchOptions = {
  method?: 'GET';
  headers?: Record<string, string>;
  timeoutMs?: number;
  allowedHosts: string[];
  next?: RequestInit['next'];
  cache?: RequestInit['cache'];
};

export class OutboundHttpError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'OutboundHttpError';
    this.status = status;
  }
}

export async function safeFetch(url: string, options: SafeFetchOptions): Promise<Response> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (!options.allowedHosts.includes(hostname)) {
    throw new OutboundHttpError('Destino externo nao permitido.', 403);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      signal: controller.signal,
      next: options.next,
      cache: options.cache,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new OutboundHttpError('Tempo limite excedido ao consultar servico externo.', 504);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

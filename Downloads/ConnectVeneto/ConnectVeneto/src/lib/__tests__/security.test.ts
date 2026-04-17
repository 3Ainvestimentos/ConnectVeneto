import { z } from 'zod';
import { OutboundHttpError, safeFetch } from '@/lib/security/http';
import {
  getSecurityLogLevel,
  logSecurityEvent,
  redactForLogs,
  resetSecurityLogLevel,
  setSecurityLogLevel,
} from '@/lib/security/logging';
import { validateSearchParams } from '@/lib/security/validation';

describe('security shared layer', () => {
  describe('validateSearchParams', () => {
    it('retorna parametros validados', () => {
      const schema = z.object({
        year: z.coerce.number().int().min(1900).max(2100),
      });

      const result = validateSearchParams('https://example.test/api?year=2026', schema);

      expect(result.year).toBe(2026);
    });

    it('falha para parametros invalidos', () => {
      const schema = z.object({
        year: z.coerce.number().int().min(1900).max(2100),
      });

      expect(() =>
        validateSearchParams('https://example.test/api?year=1800', schema)
      ).toThrow('Number must be greater than or equal to 1900');
    });
  });

  describe('redactForLogs', () => {
    it('redige chaves sensiveis e emails', () => {
      const result = redactForLogs({
        token: 'abc123',
        nested: { userEmail: 'user@venetomfo.com.br' },
      });

      expect(result).toEqual({
        token: '[REDACTED]',
        nested: { userEmail: '[REDACTED]' },
      });
    });
  });

  describe('logSecurityEvent', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    beforeEach(() => {
      consoleErrorSpy.mockClear();
      resetSecurityLogLevel();
    });

    afterAll(() => {
      consoleErrorSpy.mockRestore();
      resetSecurityLogLevel();
    });

    it('nivel padrao em ambiente de teste e silent', () => {
      expect(getSecurityLogLevel()).toBe('silent');
    });

    it('nao emite no console quando silent', () => {
      setSecurityLogLevel('silent');
      logSecurityEvent('evento-silencioso', { token: 'abc123' });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('emite com redacao quando nivel error', () => {
      setSecurityLogLevel('error');
      logSecurityEvent('falha-auth', {
        token: 'abc123',
        email: 'user@venetomfo.com.br',
      });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const [message, payload] = consoleErrorSpy.mock.calls[0];
      expect(message).toBe('falha-auth');
      expect(payload).toEqual({
        token: '[REDACTED]',
        email: '[REDACTED]',
      });
    });

    it('emite apenas a mensagem quando details e undefined', () => {
      setSecurityLogLevel('error');
      logSecurityEvent('somente-msg');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0]).toEqual(['somente-msg']);
    });
  });

  describe('safeFetch', () => {
    it('bloqueia host fora da allowlist', async () => {
      await expect(
        safeFetch('https://malicious.example/data', {
          allowedHosts: ['brasilapi.com.br'],
        })
      ).rejects.toEqual(expect.objectContaining<Partial<OutboundHttpError>>({
        message: 'Destino externo nao permitido.',
        status: 403,
      }));
    });
  });
});

/**
 * Testes de lib/module-usage: a qual módulo cada rota soma tempo e o formato exibido.
 */

import { FALLBACK_HUB_MODULES } from '@/config/modules';
import { formatDuration, resolveModuleForPath, usageDateKey } from '@/lib/module-usage';

describe('resolveModuleForPath', () => {
  it('atribui subrotas ao módulo do menu', () => {
    expect(resolveModuleForPath('/documents/glossario', FALLBACK_HUB_MODULES).id).toBe('documents');
    expect(resolveModuleForPath('/trackflow?x=1', FALLBACK_HUB_MODULES).id).toBe('trackflow');
  });

  it('dashboard só casa na rota exata', () => {
    expect(resolveModuleForPath('/dashboard', FALLBACK_HUB_MODULES).id).toBe('dashboard');
  });

  it('rota fora do menu conta pelo primeiro segmento', () => {
    expect(resolveModuleForPath('/audit/module-time', FALLBACK_HUB_MODULES)).toEqual({
      id: 'rota-audit',
      label: '/audit',
    });
  });
});

describe('formatDuration', () => {
  it.each([
    [40, '40s'],
    [720, '12min'],
    [3900, '1h 05min'],
  ])('%i s → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('usageDateKey', () => {
  it('usa o dia de São Paulo', () => {
    // 01:00 UTC ainda é o dia anterior em São Paulo (UTC-3).
    expect(usageDateKey(new Date('2026-10-23T01:00:00Z'))).toBe('2026-10-22');
  });
});

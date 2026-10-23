import { changedSince, currentStatuses, isOpenStatus } from '@/lib/feedback';

describe('feedback', () => {
  it('selo: só acende para o que mudou de status desde a última visita', () => {
    const items = [
      { id: 'a', status: 'resolvido' as const },
      { id: 'b', status: 'aberto' as const },
      { id: 'c', status: 'em_analise' as const },
    ];
    const seen = { a: 'aberto' as const, b: 'aberto' as const };
    expect(changedSince(items, seen)).toEqual(['a']);
    expect(currentStatuses(items)).toEqual({ a: 'resolvido', b: 'aberto', c: 'em_analise' });
    expect([isOpenStatus('aberto'), isOpenStatus('em_analise'), isOpenStatus('resolvido')]).toEqual([true, true, false]);
  });
});

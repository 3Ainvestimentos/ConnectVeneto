import { competenciaLabel, toIndicators } from '@/lib/hub/strategic';

describe('hub/strategic', () => {
  it('formata o fechamento do contrato (set/2026)', () => {
    const [aum, churn, roa] = toIndicators({
      competencia: '2026-09',
      aum: { valor: 7483069931.53, variacaoMes: 0.0563 },
      churn: { valor: -0.0074, janela: 'YTD', variacao: 0.0002 },
      roa: { valor: 0.00447, janela: 'posicao', variacao: -0.00019 },
    });
    expect(aum).toMatchObject({ value: 'R$ 7,48 bi', delta: '+5,6% no mês', trend: 'up', tone: 'positive' });
    expect(churn).toMatchObject({ value: '−0,74%', delta: '+0,02 p.p.', tone: 'positive', hint: 'acumulado do ano' });
    expect(roa).toMatchObject({ value: '0,45% a.a.', delta: '−0,02 p.p.', trend: 'down', tone: 'negative' });
    expect(competenciaLabel('2026-09')).toBe('set/2026');
  });

  it('indicador sem fechamento some; variação nula vira traço neutro', () => {
    const list = toIndicators({ competencia: '2026-01', aum: { valor: 9.5e8, variacaoMes: null }, churn: null, roa: null });
    expect(list).toEqual([{ label: 'AuM', hint: 'patrimônio sob gestão', value: 'R$ 950,0 mi', delta: '—', trend: 'flat', tone: 'neutral' }]);
  });
});

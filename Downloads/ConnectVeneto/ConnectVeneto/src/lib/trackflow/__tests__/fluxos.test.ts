import { venetoSolicitacoesAreas, type SolicitationArea } from '@/config/veneto-solicitacoes';
import { getIcon, iconMap } from '@/lib/icons';
import {
  TRACKFLOW_AREA_ICON,
  TRACKFLOW_DEFAULT_SUBTITLE,
  fluxoToSolicitationItem,
  mergeFluxosIntoAreas,
  normalizeAreaTitle,
  parseTrackflowFluxos,
  type TrackflowFluxo,
} from '@/lib/trackflow/fluxos';

const SGT: TrackflowFluxo = {
  id: '8E1297E1-0000-0000-0000-000000000001',
  sigla: 'SGT',
  nome: 'Solicitações Gerais Tecnologia',
  descricao: null,
  areaId: 'B61A7CFC-0000-0000-0000-000000000002',
  areaNome: 'Tecnologia e Dados',
  path: '/fluxos/8E1297E1-0000-0000-0000-000000000001/abrir',
};

const areas: SolicitationArea[] = [
  {
    id: 'inteligencia-comercial',
    title: 'Inteligencia Comercial',
    icon: 'BarChart',
    items: [{ kind: 'external', title: 'Form', href: 'https://forms.example/1' }],
  },
  { id: 'geral', title: 'Geral', icon: 'LayoutGrid', items: [] },
];

describe('fluxoToSolicitationItem', () => {
  it('monta o cartão com deep link interno do TrackFlow', () => {
    expect(fluxoToSolicitationItem(SGT)).toEqual({
      kind: 'external',
      title: 'Solicitações Gerais Tecnologia',
      subtitle: TRACKFLOW_DEFAULT_SUBTITLE,
      href: `/trackflow?to=${encodeURIComponent(SGT.path)}`,
      newTab: false,
      trackingKey: 'trackflow_SGT',
    });
  });

  it('usa a descrição do fluxo como subtítulo quando houver', () => {
    expect(fluxoToSolicitationItem({ ...SGT, descricao: 'Acessos e sistemas' }).subtitle).toBe(
      'Acessos e sistemas',
    );
  });
});

describe('normalizeAreaTitle', () => {
  it('ignora acento, caixa e espaços extras', () => {
    expect(normalizeAreaTitle('  Inteligência   COMERCIAL ')).toBe('inteligencia comercial');
  });
});

describe('mergeFluxosIntoAreas', () => {
  it('sem fluxos devolve a mesma lista', () => {
    expect(mergeFluxosIntoAreas(areas, [])).toBe(areas);
  });

  it('cria área nova no fim quando o nome não existe', () => {
    const merged = mergeFluxosIntoAreas(areas, [SGT]);
    expect(merged).toHaveLength(3);
    expect(merged.slice(0, 2)).toEqual(areas);
    expect(merged[2]).toMatchObject({
      id: `trackflow-${SGT.areaId}`,
      title: 'Tecnologia e Dados',
      icon: TRACKFLOW_AREA_ICON,
      items: [fluxoToSolicitationItem(SGT)],
    });
  });

  it('entra na área existente com o mesmo nome (sem acento e sem caixa)', () => {
    const fluxo = { ...SGT, sigla: 'SIC', areaNome: 'Inteligência comercial' };
    const merged = mergeFluxosIntoAreas(areas, [fluxo]);
    expect(merged).toHaveLength(2);
    expect(merged[0].items).toHaveLength(2);
    expect(merged[0].items[1]).toEqual(fluxoToSolicitationItem(fluxo));
  });

  it('agrupa fluxos da mesma área nova numa área só', () => {
    const outro = { ...SGT, id: 'outro', sigla: 'ACS', nome: 'Acessos' };
    const merged = mergeFluxosIntoAreas(areas, [SGT, outro]);
    expect(merged).toHaveLength(3);
    expect(merged[2].items.map((i) => i.title)).toEqual(['Solicitações Gerais Tecnologia', 'Acessos']);
  });

  it('não altera a lista recebida', () => {
    const snapshot = JSON.parse(JSON.stringify(areas));
    mergeFluxosIntoAreas(areas, [{ ...SGT, areaNome: 'Geral' }]);
    expect(areas).toEqual(snapshot);
  });

  it('não duplica cartão já cadastrado com o mesmo trackingKey', () => {
    const comCartao: SolicitationArea[] = [
      { ...areas[1], title: 'Tecnologia e Dados', items: [fluxoToSolicitationItem(SGT)] },
    ];
    const merged = mergeFluxosIntoAreas(comCartao, [SGT]);
    expect(merged[0].items).toHaveLength(1);
  });

  it('com a lista fixa, o SGT cria "Tecnologia e Dados" e preserva as áreas fixas', () => {
    const merged = mergeFluxosIntoAreas(venetoSolicitacoesAreas, [SGT]);
    expect(merged).toHaveLength(venetoSolicitacoesAreas.length + 1);
    expect(merged.slice(0, -1)).toEqual(venetoSolicitacoesAreas);
    expect(merged[merged.length - 1].title).toBe('Tecnologia e Dados');
  });
});

describe('parseTrackflowFluxos', () => {
  it('aceita a resposta do TrackFlow', () => {
    expect(parseTrackflowFluxos({ fluxos: [SGT] })).toEqual([SGT]);
  });

  it('resposta inválida vira lista vazia', () => {
    expect(parseTrackflowFluxos(null)).toEqual([]);
    expect(parseTrackflowFluxos({})).toEqual([]);
    expect(parseTrackflowFluxos({ fluxos: 'x' })).toEqual([]);
  });

  it('descarta entradas incompletas, caminhos inseguros e ids repetidos', () => {
    const result = parseTrackflowFluxos({
      fluxos: [
        SGT,
        SGT,
        { ...SGT, id: 'a', path: '//evil.example/x' },
        { ...SGT, id: 'b', path: 'https://evil.example/x' },
        { ...SGT, id: 'c', nome: '' },
        { ...SGT, id: 'd', areaNome: undefined },
        null,
      ],
    });
    expect(result).toEqual([SGT]);
  });

  it('descrição vazia vira null', () => {
    expect(parseTrackflowFluxos({ fluxos: [{ ...SGT, descricao: '  ' }] })[0].descricao).toBeNull();
  });
});

describe('ícone das áreas do TrackFlow', () => {
  it('existe no iconMap', () => {
    expect(iconMap[TRACKFLOW_AREA_ICON]).toBeDefined();
    expect(getIcon(TRACKFLOW_AREA_ICON)).toBe(iconMap[TRACKFLOW_AREA_ICON]);
  });
});

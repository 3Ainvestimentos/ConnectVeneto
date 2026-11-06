/**
 * Testes de lib/solicitacoes-href: quais links o editor aceita e onde cada um abre.
 */

import {
  isInternalHref,
  isValidSolicitationHref,
  solicitationHrefType,
  solicitationLinkTarget,
} from '@/lib/solicitacoes-href';

describe('isInternalHref', () => {
  it('aceita rotas do Connect, com query', () => {
    expect(isInternalHref('/formularios-cadastro')).toBe(true);
    expect(isInternalHref('/trackflow?to=%2Ffluxos%2F1')).toBe(true);
  });

  it('recusa URLs de outra origem disfarçadas de caminho', () => {
    expect(isInternalHref('//evil.com')).toBe(false);
    expect(isInternalHref('/\\evil.com')).toBe(false);
  });

  it('recusa links absolutos e caminhos com espaço', () => {
    expect(isInternalHref('https://forms.monday.com/x')).toBe(false);
    expect(isInternalHref('/com espaco')).toBe(false);
  });
});

describe('isValidSolicitationHref', () => {
  it.each(['https://forms.gle/abc', 'http://x.com', 'mailto:a@venetomfo.com.br', '/formularios-cadastro'])(
    'aceita %s',
    (href) => expect(isValidSolicitationHref(href)).toBe(true),
  );

  it.each(['', 'forms.gle/abc', 'javascript:alert(1)', '//evil.com', '/\\evil.com'])('recusa %s', (href) =>
    expect(isValidSolicitationHref(href)).toBe(false),
  );
});

describe('solicitationHrefType', () => {
  it('classifica os três tipos', () => {
    expect(solicitationHrefType('/formularios-cadastro')).toBe('internal');
    expect(solicitationHrefType('mailto:a@b.com')).toBe('mailto');
    expect(solicitationHrefType('https://forms.gle/abc')).toBe('external');
  });
});

describe('solicitationLinkTarget', () => {
  it('rota interna e mailto abrem na mesma aba; externo em nova aba', () => {
    expect(solicitationLinkTarget({ href: '/formularios-cadastro' })).toBeUndefined();
    expect(solicitationLinkTarget({ href: 'mailto:a@b.com' })).toBeUndefined();
    expect(solicitationLinkTarget({ href: 'https://forms.gle/abc' })).toBe('_blank');
  });

  it('newTab explícito prevalece', () => {
    expect(solicitationLinkTarget({ href: '/formularios-cadastro', newTab: true })).toBe('_blank');
    expect(solicitationLinkTarget({ href: 'https://forms.gle/abc', newTab: false })).toBeUndefined();
  });
});

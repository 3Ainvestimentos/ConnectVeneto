/**
 * Editores por documento da Biblioteca Comercial: quem atualiza um material sem ser gestor.
 */

import { canEditCommercialDocument } from '@/config/biblioteca-comercial';

describe('canEditCommercialDocument', () => {
  const document = { editorEmails: ['lucas.freitas@venetomfo.com.br'] };

  it('gestor edita qualquer documento', () => {
    expect(canEditCommercialDocument({}, 'gestor@venetomfo.com.br', true)).toBe(true);
  });

  it('editor listado edita, sem diferenciar maiúsculas', () => {
    expect(canEditCommercialDocument(document, 'Lucas.Freitas@venetomfo.com.br', false)).toBe(true);
  });

  it('quem não está na lista não edita', () => {
    expect(canEditCommercialDocument(document, 'outra.pessoa@venetomfo.com.br', false)).toBe(false);
    expect(canEditCommercialDocument({}, 'lucas.freitas@venetomfo.com.br', false)).toBe(false);
    expect(canEditCommercialDocument(document, null, false)).toBe(false);
  });
});

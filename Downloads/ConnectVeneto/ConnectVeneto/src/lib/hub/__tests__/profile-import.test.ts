import { parseProfileImport, toIsoDate } from '@/lib/hub/profile-import';

describe('hub/profile-import', () => {
  it('converte datas da planilha', () => {
    expect(toIsoDate('31/12/1990')).toBe('1990-12-31');
    expect(toIsoDate('1/2/1985')).toBe('1985-02-01');
    expect(toIsoDate('1990-12-31')).toBe('1990-12-31');
    expect(toIsoDate(33238)).toBe('1990-12-31');
    expect(toIsoDate('')).toBe('');
    expect(toIsoDate('31/13/1990')).toBeNull();
    expect(toIsoDate('amanhã')).toBeNull();
  });

  it('lê cabeçalhos em português, só muda as colunas presentes, ignora Equipe e aponta linhas ruins', () => {
    const { rows, errors } = parseProfileImport([
      { ID: '10', 'Data de Nascimento': '05/03/1992', Equipe: 'Comercial SP' },
      { ID: '11', 'Data de Nascimento': '' },
      { ID: '12', 'Data de Nascimento': '99/99/1992' },
      { ID: '', Equipe: 'x' },
      { 'ID Gestor': '1', id: '13' },
    ]);
    expect(rows).toEqual([
      { idVeneto: '10', birthDate: '1992-03-05' },
      { idVeneto: '11', birthDate: '' },
      { idVeneto: '13', leaderIdVeneto: '1' },
    ]);
    expect(errors.map((e) => e.line)).toEqual([4, 5]);
  });
});

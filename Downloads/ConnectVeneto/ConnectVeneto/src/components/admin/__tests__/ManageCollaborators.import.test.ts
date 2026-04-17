/**
 * @jest-environment jsdom
 *
 * Testes de hardening do import de colaboradores.
 * Cobre: limite de tamanho, limite de linhas e erro explicito para planilhas invalidas.
 */

import {
  COLLABORATORS_IMPORT_MAX_BYTES,
  COLLABORATORS_IMPORT_MAX_ROWS,
  CollaboratorsImportError,
  parseCsvFile,
  parseXlsxFile,
  validateImportFileSize,
} from '../ManageCollaborators';

jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

function fakeFile(size: number, name = 'planilha.xlsx'): File {
  const file = new File([''], name, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function fakeXlsxFile(size = 1024): File {
  return {
    size,
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as File;
}

function csvWithRows(rows: number): string {
  const header = 'ID,NOME USUAL,E-MAIL,ÁREA,CARGO,LÍDER,CIDADE';
  const body = Array.from({ length: rows }, (_, i) =>
    `${i},Nome ${i},user${i}@venetomfo.com.br,Area,Cargo,Lider,Cidade`
  ).join('\n');
  return `${header}\n${body}`;
}

describe('ManageCollaborators import hardening', () => {
  describe('validateImportFileSize', () => {
    it('aceita arquivo dentro do limite', () => {
      const file = fakeFile(COLLABORATORS_IMPORT_MAX_BYTES - 1);
      expect(() => validateImportFileSize(file)).not.toThrow();
    });

    it('aceita arquivo exatamente no limite', () => {
      const file = fakeFile(COLLABORATORS_IMPORT_MAX_BYTES);
      expect(() => validateImportFileSize(file)).not.toThrow();
    });

    it('rejeita arquivo acima do limite com CollaboratorsImportError', () => {
      const file = fakeFile(COLLABORATORS_IMPORT_MAX_BYTES + 1);
      expect(() => validateImportFileSize(file)).toThrow(CollaboratorsImportError);
    });

    it('mensagem de erro indica o limite em MB', () => {
      const file = fakeFile(COLLABORATORS_IMPORT_MAX_BYTES + 1);
      try {
        validateImportFileSize(file);
        fail('deveria ter lancado');
      } catch (error) {
        expect(error).toBeInstanceOf(CollaboratorsImportError);
        expect((error as Error).message).toMatch(/5 MB/);
      }
    });
  });

  describe('limites exportados', () => {
    it('mantem teto de 5000 linhas por importacao', () => {
      expect(COLLABORATORS_IMPORT_MAX_ROWS).toBe(5000);
    });

    it('mantem teto de 5MB por arquivo', () => {
      expect(COLLABORATORS_IMPORT_MAX_BYTES).toBe(5 * 1024 * 1024);
    });
  });

  describe('parseCsvFile', () => {
    it('rejeita quando CSV ultrapassa o limite de linhas', async () => {
      const file = new File([csvWithRows(COLLABORATORS_IMPORT_MAX_ROWS + 1)], 'colaboradores.csv', {
        type: 'text/csv',
      });

      await expect(parseCsvFile(file)).rejects.toThrow(CollaboratorsImportError);
    });
  });

  describe('parseXlsxFile', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('rejeita planilha sem aba', async () => {
      const XLSX = await import('xlsx');
      jest.mocked(XLSX.read).mockReturnValue({ SheetNames: [], Sheets: {} } as never);

      const file = fakeXlsxFile();
      await expect(parseXlsxFile(file)).rejects.toThrow(/nenhuma aba encontrada/i);
    });

    it('rejeita planilha acima de 5000 linhas', async () => {
      const XLSX = await import('xlsx');
      jest.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Plan1'],
        Sheets: { Plan1: {} },
      } as never);
      jest.mocked(XLSX.utils.sheet_to_json).mockReturnValue(
        Array.from({ length: COLLABORATORS_IMPORT_MAX_ROWS + 1 }, () => ({ ID: '1' })) as never
      );

      const file = fakeXlsxFile();
      await expect(parseXlsxFile(file)).rejects.toThrow(CollaboratorsImportError);
    });
  });
});

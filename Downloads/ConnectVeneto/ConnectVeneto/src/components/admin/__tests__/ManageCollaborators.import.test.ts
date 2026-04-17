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
  validateImportFileSize,
} from '../ManageCollaborators';

function fakeFile(size: number, name = 'planilha.xlsx'): File {
  const file = new File([''], name, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
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
});

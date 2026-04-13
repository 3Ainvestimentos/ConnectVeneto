/**
 * Testes unitários para email-utils
 * 
 * Testam as funções puras de normalização e busca de emails
 */

import {
  normalizeEmail,
  findCollaboratorByEmail,
  filterCollaboratorsByEmails,
  emailsMatch,
} from '@/lib/email-utils';

describe('email-utils', () => {
  describe('normalizeEmail', () => {
    it('deve normalizar email para lowercase', () => {
      expect(normalizeEmail('Usuario@Exemplo.COM')).toBe('usuario@exemplo.com');
    });

    it('deve remover espaços em branco', () => {
      expect(normalizeEmail('  usuario@exemplo.com  ')).toBe('usuario@exemplo.com');
    });

    it('deve retornar null para string vazia', () => {
      expect(normalizeEmail('')).toBeNull();
    });

    it('deve retornar null para null', () => {
      expect(normalizeEmail(null)).toBeNull();
    });

    it('deve retornar null para undefined', () => {
      expect(normalizeEmail(undefined)).toBeNull();
    });

    it('deve preservar caracteres especiais válidos em emails', () => {
      expect(normalizeEmail('usuario+tag@exemplo.com')).toBe('usuario+tag@exemplo.com');
    });
  });

  describe('findCollaboratorByEmail', () => {
    interface MockCollaborator {
      email: string;
      name: string;
    }

    const collaborators: MockCollaborator[] = [
      { email: 'joao@exemplo.com', name: 'João' },
      { email: 'maria@exemplo.com', name: 'Maria' },
      { email: 'pedro@exemplo.com', name: 'Pedro' },
    ];

    it('deve encontrar colaborador por email exato', () => {
      const result = findCollaboratorByEmail(collaborators, 'joao@exemplo.com');
      expect(result).toEqual({ email: 'joao@exemplo.com', name: 'João' });
    });

    it('deve encontrar colaborador com email em case diferente', () => {
      const result = findCollaboratorByEmail(collaborators, 'JOAO@EXEMPLO.COM');
      expect(result).toEqual({ email: 'joao@exemplo.com', name: 'João' });
    });

    it('deve encontrar colaborador com espaços no email', () => {
      const result = findCollaboratorByEmail(collaborators, '  joao@exemplo.com  ');
      expect(result).toEqual({ email: 'joao@exemplo.com', name: 'João' });
    });

    it('deve retornar undefined para email não encontrado', () => {
      const result = findCollaboratorByEmail(collaborators, 'naoexiste@exemplo.com');
      expect(result).toBeUndefined();
    });

    it('deve retornar undefined para array vazio', () => {
      const result = findCollaboratorByEmail<MockCollaborator>([], 'joao@exemplo.com');
      expect(result).toBeUndefined();
    });

    it('deve retornar undefined para email null', () => {
      const result = findCollaboratorByEmail(collaborators, null);
      expect(result).toBeUndefined();
    });

    it('deve retornar undefined para email undefined', () => {
      const result = findCollaboratorByEmail(collaborators, undefined);
      expect(result).toBeUndefined();
    });

    it('deve retornar undefined para array null', () => {
      const result = findCollaboratorByEmail(null as any, 'joao@exemplo.com');
      expect(result).toBeUndefined();
    });
  });

  describe('filterCollaboratorsByEmails', () => {
    interface MockCollaborator {
      email: string;
      name: string;
    }

    const collaborators: MockCollaborator[] = [
      { email: 'joao@exemplo.com', name: 'João' },
      { email: 'maria@exemplo.com', name: 'Maria' },
      { email: 'pedro@exemplo.com', name: 'Pedro' },
    ];

    it('deve filtrar colaboradores por lista de emails', () => {
      const result = filterCollaboratorsByEmails(collaborators, [
        'joao@exemplo.com',
        'pedro@exemplo.com',
      ]);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('João');
      expect(result[1].name).toBe('Pedro');
    });

    it('deve filtrar com emails em case diferente', () => {
      const result = filterCollaboratorsByEmails(collaborators, [
        'JOAO@EXEMPLO.COM',
        'MARIA@EXEMPLO.COM',
      ]);
      expect(result).toHaveLength(2);
    });

    it('deve retornar array vazio se nenhum email corresponder', () => {
      const result = filterCollaboratorsByEmails(collaborators, [
        'naoexiste@exemplo.com',
      ]);
      expect(result).toEqual([]);
    });

    it('deve retornar array vazio para lista de emails vazia', () => {
      const result = filterCollaboratorsByEmails(collaborators, []);
      expect(result).toEqual([]);
    });

    it('deve retornar array vazio para lista de emails null', () => {
      const result = filterCollaboratorsByEmails(collaborators, null as any);
      expect(result).toEqual([]);
    });

    it('deve retornar array vazio para array de colaboradores vazio', () => {
      const result = filterCollaboratorsByEmails<MockCollaborator>([], ['joao@exemplo.com']);
      expect(result).toEqual([]);
    });

    it('deve ignorar emails null na lista', () => {
      const result = filterCollaboratorsByEmails(collaborators, [
        'joao@exemplo.com',
        null as any,
        'pedro@exemplo.com',
      ]);
      expect(result).toHaveLength(2);
    });
  });

  describe('emailsMatch', () => {
    it('deve retornar true para emails idênticos', () => {
      expect(emailsMatch('joao@exemplo.com', 'joao@exemplo.com')).toBe(true);
    });

    it('deve retornar true para emails com case diferente', () => {
      expect(emailsMatch('JOAO@EXEMPLO.COM', 'joao@exemplo.com')).toBe(true);
    });

    it('deve retornar true para emails com espaços', () => {
      expect(emailsMatch('  joao@exemplo.com  ', 'joao@exemplo.com')).toBe(true);
    });

    it('deve retornar false para emails diferentes', () => {
      expect(emailsMatch('joao@exemplo.com', 'maria@exemplo.com')).toBe(false);
    });

    it('deve retornar false para primeiro email null', () => {
      expect(emailsMatch(null, 'joao@exemplo.com')).toBe(false);
    });

    it('deve retornar false para segundo email null', () => {
      expect(emailsMatch('joao@exemplo.com', null)).toBe(false);
    });

    it('deve retornar false para ambos emails null', () => {
      expect(emailsMatch(null, null)).toBe(false);
    });

    it('deve retornar false para ambos emails undefined', () => {
      expect(emailsMatch(undefined, undefined)).toBe(false);
    });
  });
});

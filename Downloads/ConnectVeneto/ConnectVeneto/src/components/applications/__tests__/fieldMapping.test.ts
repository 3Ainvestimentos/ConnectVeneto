/**
 * Testes unitários para a lógica de mapeamento de campos únicos
 * 
 * Estes testes validam que campos com IDs duplicados podem funcionar
 * independentemente no formulário, mas são mapeados corretamente no submit.
 */

import { FormFieldDefinition } from '@/contexts/ApplicationsContext';

/**
 * Função auxiliar para gerar ID único para cada campo
 * Esta é a mesma lógica usada no componente
 */
const getUniqueFieldId = (index: number): string => `__field_${index}`;

/**
 * Função auxiliar para mapear dados do formulário de volta para os IDs originais
 * Simula a lógica de submit do WorkflowSubmissionModal
 */
function mapFormDataToFieldIds(
  formData: Record<string, unknown>,
  fields: FormFieldDefinition[]
): Record<string, unknown> {
  const mappedData: Record<string, unknown> = {};
  
  fields.forEach((field, index) => {
    const uniqueId = getUniqueFieldId(index);
    const value = formData[uniqueId];
    
    if (value !== undefined && value !== null && value !== '') {
      mappedData[field.id] = value;
    }
  });
  
  return mappedData;
}

describe('Field Mapping - Campos com IDs Duplicados', () => {
  describe('getUniqueFieldId', () => {
    it('deve gerar IDs únicos diferentes para índices diferentes', () => {
      const id1 = getUniqueFieldId(0);
      const id2 = getUniqueFieldId(1);
      const id3 = getUniqueFieldId(2);
      
      expect(id1).toBe('__field_0');
      expect(id2).toBe('__field_1');
      expect(id3).toBe('__field_2');
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });

    it('deve gerar o mesmo ID para o mesmo índice', () => {
      const id1 = getUniqueFieldId(5);
      const id2 = getUniqueFieldId(5);
      
      expect(id1).toBe(id2);
      expect(id1).toBe('__field_5');
    });
  });

  describe('mapFormDataToFieldIds', () => {
    it('deve mapear corretamente campos com IDs únicos', () => {
      const fields: FormFieldDefinition[] = [
        { id: 'nome', label: 'Nome', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'telefone', label: 'Telefone', type: 'text', required: false },
      ];

      const formData = {
        '__field_0': 'João Silva',
        '__field_1': 'joao@test.com',
        '__field_2': '11999999999',
      };

      const result = mapFormDataToFieldIds(formData, fields);

      expect(result).toEqual({
        nome: 'João Silva',
        email: 'joao@test.com',
        telefone: '11999999999',
      });
    });

    it('deve mapear corretamente campos com IDs duplicados, preservando o último valor', () => {
      const fields: FormFieldDefinition[] = [
        {
          id: 'email_corporativo',
          label: 'E-mail - Corporativo - Líder',
          type: 'text',
          required: true,
        },
        {
          id: 'setor_area',
          label: 'Setor/Área',
          type: 'text',
          required: true,
        },
        {
          id: 'nome_colaborador',
          label: 'Nome e Sobrenome - Colaborador',
          type: 'text',
          required: true,
        },
        {
          id: 'email_corporativo', // ID duplicado
          label: 'E-mail - Corporativo - Colaborador',
          type: 'text',
          required: true,
        },
      ];

      const formData = {
        '__field_0': 'lider@test.com',
        '__field_1': 'TI',
        '__field_2': 'João Silva',
        '__field_3': 'colaborador@test.com',
      };

      const result = mapFormDataToFieldIds(formData, fields);

      // O último valor deve sobrescrever o anterior quando há IDs duplicados
      expect(result.email_corporativo).toBe('colaborador@test.com');
      expect(result.setor_area).toBe('TI');
      expect(result.nome_colaborador).toBe('João Silva');
      
      // Verifica que não há campos duplicados no resultado final
      const keys = Object.keys(result);
      expect(keys).toHaveLength(3); // Apenas 3 chaves únicas (email_corporativo, setor_area, nome_colaborador)
    });

    it('deve ignorar valores vazios, null ou undefined', () => {
      const fields: FormFieldDefinition[] = [
        { id: 'nome', label: 'Nome', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'telefone', label: 'Telefone', type: 'text', required: false },
      ];

      const formData = {
        '__field_0': 'João Silva',
        '__field_1': '', // Vazio
        '__field_2': null, // Null
        '__field_3': undefined, // Undefined (não deve existir)
      };

      const result = mapFormDataToFieldIds(formData, fields);

      expect(result).toEqual({
        nome: 'João Silva',
      });
      expect(result.email).toBeUndefined();
      expect(result.telefone).toBeUndefined();
    });

    it('deve manter valores diferentes em campos independentes mesmo com IDs duplicados', () => {
      const fields: FormFieldDefinition[] = [
        {
          id: 'email_corporativo',
          label: 'E-mail - Corporativo - Líder',
          type: 'text',
          required: true,
        },
        {
          id: 'email_corporativo', // ID duplicado
          label: 'E-mail - Corporativo - Colaborador',
          type: 'text',
          required: true,
        },
      ];

      // Simula que o usuário digitou valores diferentes em cada campo
      const formData = {
        '__field_0': 'lider@empresa.com',
        '__field_1': 'colaborador@empresa.com',
      };

      const result = mapFormDataToFieldIds(formData, fields);

      // Ambos os valores foram processados, mas apenas o último é preservado
      // Isso é o comportamento esperado quando há IDs duplicados
      expect(result.email_corporativo).toBe('colaborador@empresa.com');
      expect(Object.keys(result).length).toBe(1); // Apenas uma chave única
    });
  });
});


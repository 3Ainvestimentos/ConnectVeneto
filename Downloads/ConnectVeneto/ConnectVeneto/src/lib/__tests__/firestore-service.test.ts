/**
 * Testes unitários para o Firestore Service
 * 
 * Testam as funções CRUD e utilitários de Firestore
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getCollection,
  getDocument,
  addDocumentToCollection,
  updateDocumentInCollection,
  deleteDocumentFromCollection,
  getCollectionWithQuery,
  WithId,
  FirestoreQueryFilter,
  FirestoreOrderBy,
} from '@/lib/firestore-service';

type MockDocSnap = { id: string; data: () => Record<string, unknown> };

// Mock do Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ id: 'mock-collection' })),
  doc: jest.fn((db, collectionName, docId) => ({
    id: docId,
    path: `${collectionName}/${docId}`,
  })),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  setDoc: jest.fn(),
  query: jest.fn((collectionRef) => collectionRef),
  where: jest.fn((field, operator, value) => ({ field, operator, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(() => ({
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  runTransaction: jest.fn((db, callback) => callback({ get: jest.fn(), set: jest.fn() })),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  getDownloadURL: jest.fn().mockResolvedValue('https://example.com/file.pdf'),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((event, progress, error, complete) => {
      if (complete) {
        setTimeout(complete, 0);
      }
    }),
    snapshot: { ref: {} },
  })),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({})),
  getClientFirestore: jest.fn(() => ({})),
}));

jest.mock('@/lib/data-sanitizer', () => ({
  cleanDataForFirestore: jest.fn((data) => data),
}));

jest.mock('@/lib/path-sanitizer', () => ({
  buildStorageFilePath: jest.fn((path, requestId, fileName) => `${path}/${requestId}/${fileName}`),
  sanitizeStoragePath: jest.fn((path) => {
    if (path.includes('..')) {
      throw new Error('Path traversal detected');
    }
    return path;
  }),
}));

describe('Firestore Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCollection', () => {
    it('deve retornar todos os documentos da coleção', async () => {
      const mockDocs: MockDocSnap[] = [
        { id: '1', data: () => ({ name: 'Doc 1' }) },
        { id: '2', data: () => ({ name: 'Doc 2' }) },
      ];
      
      getDocs.mockResolvedValue({
        forEach: (callback: (d: MockDocSnap) => void) => mockDocs.forEach(callback),
      });

      const result = await getCollection('test-collection');

      expect(collection).toHaveBeenCalledWith(expect.anything(), 'test-collection');
      expect(getDocs).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', '1');
      expect(result[0]).toHaveProperty('name', 'Doc 1');
    });

    it('deve retornar array vazio se coleção estiver vazia', async () => {
      getDocs.mockResolvedValue({
        forEach: () => {},
      });

      const result = await getCollection('empty-collection');

      expect(result).toEqual([]);
    });

    it('deve tratar erros ao buscar coleção', async () => {
      getDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(getCollection('error-collection')).rejects.toThrow(
        'Não foi possível carregar a coleção de error-collection.'
      );
    });
  });

  describe('getDocument', () => {
    it('deve retornar um documento específico', async () => {
      getDoc.mockResolvedValue({
        exists: () => true,
        id: 'doc-123',
        data: () => ({ name: 'Test Doc', status: 'active' }),
      });

      const result = await getDocument('test-collection', 'doc-123');

      expect(doc).toHaveBeenCalledWith(expect.anything(), 'test-collection', 'doc-123');
      expect(getDoc).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'doc-123',
        name: 'Test Doc',
        status: 'active',
      });
    });

    it('deve retornar null se documento não existir', async () => {
      getDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getDocument('test-collection', 'non-existent');

      expect(result).toBeNull();
    });

    it('deve tratar erros ao buscar documento', async () => {
      getDoc.mockRejectedValue(new Error('Not found'));

      await expect(getDocument('test-collection', 'error-doc')).rejects.toThrow(
        'Não foi possível carregar o documento.'
      );
    });
  });

  describe('addDocumentToCollection', () => {
    it('deve adicionar um documento à coleção', async () => {
      addDoc.mockResolvedValue({ id: 'new-doc-id' });

      const data = { name: 'New Document', status: 'pending' };
      const result = await addDocumentToCollection('test-collection', data);

      expect(addDoc).toHaveBeenCalled();
      expect(result.id).toBe('new-doc-id');
      expect(result.name).toBe('New Document');
    });

    it('deve gerar ID automaticamente se não fornecido', async () => {
      addDoc.mockResolvedValue({ id: 'auto-generated-id' });

      const data = { name: 'Auto ID Document' };
      const result = await addDocumentToCollection('test-collection', data);

      expect(result.id).toBe('auto-generated-id');
      expect(result.name).toBe('Auto ID Document');
    });

    it('deve tratar erros ao adicionar documento', async () => {
      addDoc.mockRejectedValue(new Error('Permission denied'));

      await expect(
        addDocumentToCollection('test-collection', { name: 'Fail' })
      ).rejects.toThrow('Não foi possível adicionar o novo item. Detalhes: Permission denied');
    });
  });

  describe('updateDocumentInCollection', () => {
    it('deve atualizar um documento existente', async () => {
      updateDoc.mockResolvedValue(undefined);

      const data = { name: 'Updated Document', status: 'completed' };
      
      await updateDocumentInCollection('test-collection', 'doc-123', data);

      expect(doc).toHaveBeenCalledWith(expect.anything(), 'test-collection', 'doc-123');
      expect(updateDoc).toHaveBeenCalled();
    });

    it('deve mesclar dados automaticamente', async () => {
      updateDoc.mockResolvedValue(undefined);

      await updateDocumentInCollection('test-collection', 'doc-123', { status: 'updated' });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { status: 'updated' }
      );
    });

    it('deve tratar erros ao atualizar documento', async () => {
      updateDoc.mockRejectedValue(new Error('Not found'));

      await expect(
        updateDocumentInCollection('test-collection', 'non-existent', { name: 'Fail' })
      ).rejects.toThrow('Não foi possível salvar as alterações. Detalhes: Not found');
    });
  });

  describe('deleteDocumentFromCollection', () => {
    it('deve deletar um documento existente', async () => {
      deleteDoc.mockResolvedValue(undefined);

      await deleteDocumentFromCollection('test-collection', 'doc-123');

      expect(doc).toHaveBeenCalledWith(expect.anything(), 'test-collection', 'doc-123');
      expect(deleteDoc).toHaveBeenCalled();
    });

    it('deve tratar erros ao deletar documento', async () => {
      deleteDoc.mockRejectedValue(new Error('Permission denied'));

      await expect(
        deleteDocumentFromCollection('test-collection', 'doc-123')
      ).rejects.toThrow('Não foi possível remover o item.');
    });
  });

  describe('getCollectionWithQuery', () => {
    it('deve retornar documentos com filtro simples', async () => {
      const mockDocs: MockDocSnap[] = [
        { id: '1', data: () => ({ name: 'Active Doc', status: 'active' }) },
      ];
      
      getDocs.mockResolvedValue({
        forEach: (callback: (d: MockDocSnap) => void) => mockDocs.forEach(callback),
      });

      const filters: FirestoreQueryFilter[] = [
        { field: 'status', operator: '==', value: 'active' },
      ];

      const result = await getCollectionWithQuery('test-collection', filters);

      expect(where).toHaveBeenCalledWith('status', '==', 'active');
      expect(getDocs).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('status', 'active');
    });

    it('deve retornar documentos com múltiplos filtros', async () => {
      const mockDocs: MockDocSnap[] = [
        { id: '1', data: () => ({ name: 'Doc 1', status: 'active', category: 'A' }) },
      ];
      
      getDocs.mockResolvedValue({
        forEach: (callback: (d: MockDocSnap) => void) => mockDocs.forEach(callback),
      });

      const filters: FirestoreQueryFilter[] = [
        { field: 'status', operator: '==', value: 'active' },
        { field: 'category', operator: '==', value: 'A' },
      ];

      const result = await getCollectionWithQuery('test-collection', filters);

      expect(result).toHaveLength(1);
    });

    it('deve ordenar resultados quando orderByCriteria é fornecido', async () => {
      const mockDocs: MockDocSnap[] = [
        { id: '1', data: () => ({ name: 'Doc 1', createdAt: '2024-01-01' }) },
        { id: '2', data: () => ({ name: 'Doc 2', createdAt: '2024-01-02' }) },
      ];
      
      getDocs.mockResolvedValue({
        forEach: (callback: (d: MockDocSnap) => void) => mockDocs.forEach(callback),
      });

      const orderByCriteria: FirestoreOrderBy[] = [
        { field: 'createdAt', direction: 'desc' },
      ];

      const result = await getCollectionWithQuery('test-collection', [], orderByCriteria);

      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(result).toHaveLength(2);
    });

    it('deve retornar array vazio se nenhum documento corresponder', async () => {
      getDocs.mockResolvedValue({
        forEach: () => {},
      });

      const filters: FirestoreQueryFilter[] = [
        { field: 'status', operator: '==', value: 'non-existent' },
      ];

      const result = await getCollectionWithQuery('test-collection', filters);

      expect(result).toEqual([]);
    });

    it('deve tratar erros na query', async () => {
      getDocs.mockRejectedValue(new Error('Invalid query'));

      await expect(
        getCollectionWithQuery('test-collection', [
          { field: 'status', operator: '==', value: 'active' },
        ])
      ).rejects.toThrow('Não foi possível carregar a coleção de test-collection com os filtros especificados.');
    });
  });

  describe('WithId type', () => {
    it('deve adicionar propriedade id ao tipo', () => {
      interface TestDoc {
        name: string;
        status: string;
      }

      const doc: WithId<TestDoc> = {
        id: 'test-123',
        name: 'Test Document',
        status: 'active',
      };

      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('name');
      expect(doc).toHaveProperty('status');
    });
  });
});

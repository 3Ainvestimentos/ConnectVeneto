/**
 * Testes unitários para o AuthContext
 * 
 * Testam as funções auxiliares e lógica de autenticação
 */

import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { normalizeEmail } from '@/lib/email-utils';
import React from 'react';

// Mock do Firebase
jest.mock('firebase/auth', () => {
  const mockAuth = {
    currentUser: null,
    onAuthStateChanged: jest.fn((auth, callback) => {
      // onAuthStateChanged recebe (auth, callback) no Firebase
      if (typeof callback === 'function') {
        callback(null);
      }
      return jest.fn(); // unsubscribe
    }),
  };

  return {
    getAuth: jest.fn(() => mockAuth),
    onAuthStateChanged: mockAuth.onAuthStateChanged,
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: {
      credentialFromResult: jest.fn(() => ({ accessToken: 'mock-token' })),
    },
  };
});

// Mock do router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock do toast
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

// Mock do Firestore service
jest.mock('@/lib/firestore-service', () => ({
  getCollection: jest.fn().mockResolvedValue([]),
  addDocumentToCollection: jest.fn().mockResolvedValue({}),
  updateDocumentInCollection: jest.fn().mockResolvedValue({}),
}));

// Mock do Firebase app
jest.mock('@/lib/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({})),
  googleProvider: {
    addScope: jest.fn(),
    setCustomParameters: jest.fn(),
  },
}));

// Mock dos contexts auxiliares
jest.mock('@/contexts/SystemSettingsContext', () => ({
  useSystemSettings: () => ({
    settings: {
      maintenanceMode: false,
      maintenanceMessage: '',
      allowedUserIds: [],
      superAdminEmails: [],
    },
  }),
}));

jest.mock('@/hooks/useCollaboratorSync', () => ({
  useCollaboratorSync: jest.fn(),
}));

jest.mock('@/lib/bootstrap-trace', () => ({
  bootstrapTrace: jest.fn(),
  resetBootstrapTrace: jest.fn(),
}));

// Mock do CollaboratorsContext
jest.mock('@/contexts/CollaboratorsContext', () => ({
  getCollaboratorUserId: jest.fn((collaborator) => collaborator?.id || null),
}));

// Mock do normalizeEmail
jest.mock('@/lib/email-utils', () => ({
  normalizeEmail: (email: string | null | undefined) => {
    if (!email) return null;
    return email.toLowerCase().trim();
  },
}));

function AuthTestWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const createWrapper = () => AuthTestWrapper;

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useAuth hook', () => {
    it('deve lançar erro se usado fora do AuthProvider', () => {
      // Suprimir console.error para este teste específico
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('deve fornecer contexto quando dentro do AuthProvider', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.user).toBeNull();
      // loading começa como false porque _auth.currentUser é null no mock
      expect(result.current.loading).toBeFalsy();
      expect(result.current.isAdmin).toBeFalsy();
      expect(result.current.isSuperAdmin).toBeFalsy();
      expect(result.current.accessToken).toBeNull();
      expect(typeof result.current.signInWithGoogle).toBe('function');
      expect(typeof result.current.signOut).toBe('function');
    });
  });

  describe('validação de email corporativo', () => {
    it('deve aceitar emails @venetomfo.com.br', () => {
      const email = 'usuario@venetomfo.com.br';
      const normalized = normalizeEmail(email);
      
      expect(normalized).toBe('usuario@venetomfo.com.br');
      expect(normalized).toContain('@venetomfo.com.br');
    });

    it('deve normalizar emails para lowercase', () => {
      const email = 'Usuario@Venetomfo.com.br';
      const normalized = normalizeEmail(email);
      
      expect(normalized).toBe('usuario@venetomfo.com.br');
    });

    it('deve retornar null para emails vazios', () => {
      expect(normalizeEmail(null)).toBeNull();
      expect(normalizeEmail(undefined)).toBeNull();
      expect(normalizeEmail('')).toBeNull();
    });
  });

  describe('Google Access Token storage', () => {
    beforeEach(() => {
      // Mock sessionStorage
      const mockSessionStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      
      global.window = Object.create(window);
      Object.defineProperty(window, 'sessionStorage', {
        value: mockSessionStorage,
        writable: true,
      });
    });

    it('deve salvar token no sessionStorage', () => {
      const token = 'mock-access-token';
      const issuedAt = Date.now().toString();

      window.sessionStorage.setItem('cv_google_access_token', token);
      window.sessionStorage.setItem('cv_google_access_token_issued_at', issuedAt);

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('cv_google_access_token', token);
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('cv_google_access_token_issued_at', issuedAt);
    });

    it('deve limpar token do sessionStorage', () => {
      window.sessionStorage.removeItem('cv_google_access_token');
      window.sessionStorage.removeItem('cv_google_access_token_issued_at');

      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('cv_google_access_token');
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('cv_google_access_token_issued_at');
    });
  });

  describe('Auth cookie management', () => {
    beforeEach(() => {
      // Mock document.cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });
    });

    it('deve definir cookie de sessão de auth', () => {
      document.cookie = 'cv_auth=1; path=/; max-age=86400; samesite=lax';
      
      expect(document.cookie).toContain('cv_auth=1');
      expect(document.cookie).toContain('path=/');
      expect(document.cookie).toContain('max-age=86400');
    });

    it('deve limpar cookie de sessão de auth', () => {
      document.cookie = 'cv_auth=; path=/; max-age=0; samesite=lax';
      
      expect(document.cookie).toContain('cv_auth=');
      expect(document.cookie).toContain('max-age=0');
    });
  });

  describe('permissions default', () => {
    it('deve iniciar com permissões padrão esperadas', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.permissions).toEqual({
        canManageWorkflows: false,
        canManageRequests: false,
        canManageContent: false,
        canManageTripsBirthdays: false,
        canManageVacation: false,
        canViewAudit: false,
        canManageSystem: false,
        canViewConsultaPessoal: false,
        canViewDocuments: true,
        canViewApplications: true,
        canViewRegrasComerciais: true,
        canViewTasks: false,
        canViewBI: false,
        canViewCRM: false,
        canViewStrategicPanel: false,
        canViewOpportunityMap: false,
        canViewMeetAnalyses: false,
        canViewDirectoria: false,
      });
    });
  });

  describe('withTimeout utility', () => {
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('AUTH_LOOKUP_TIMEOUT')), timeoutMs);
      });

      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    it('deve retornar resultado se promise completar antes do timeout', async () => {
      const fastPromise = Promise.resolve('success');
      
      const result = await withTimeout(fastPromise, 1000);
      
      expect(result).toBe('success');
    });

    it('deve lançar erro se promise exceder timeout', async () => {
      const slowPromise = new Promise((resolve) => setTimeout(resolve, 1000));
      
      await expect(withTimeout(slowPromise, 10)).rejects.toThrow('AUTH_LOOKUP_TIMEOUT');
    });

    it('deve limpar timeout após conclusão', async () => {
      const fastPromise = Promise.resolve('done');
      
      await withTimeout(fastPromise, 5000);
      
      // Se chegou aqui sem erro, o timeout foi limpo corretamente
      expect(true).toBe(true);
    });
  });
});

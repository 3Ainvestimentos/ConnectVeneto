/**
 * Testes unitários para o middleware de autenticação
 * 
 * Testam a lógica de proteção de rotas e redirecionamento
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/../middleware';

// Mock do NextResponse
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server');
  
  return {
    ...originalModule,
    NextResponse: {
      next: jest.fn(() => ({ type: 'next' })),
      redirect: jest.fn((url) => ({ type: 'redirect', url })),
    },
  };
});

describe('Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isProtectedPath', () => {
    const protectedPaths = [
      '/dashboard',
      '/dashboard/test',
      '/applications',
      '/applications/123',
      '/documents',
      '/documents/folder/123',
      '/consulta',
      '/regras-comerciais',
      '/requests',
      '/requests/new',
      '/area-logada',
      '/bi',
      '/bi/report/1',
      '/opportunity-map',
      '/personal-panel',
      '/meet-analyses',
      '/me',
      '/me/profile',
      '/bob-v2',
      '/audit',
      '/admin',
      '/admin/users',
    ];

    const publicPaths = [
      '/',
      '/login',
      '/register',
      '/about',
      '/contact',
      '/api/billing',
      '/api/calendar',
      '/api/holidays',
      '/api/rss',
      '/_next/static/css/app.css',
      '/_next/image',
      '/favicon.ico',
      '/logo.png',
      '/file.pdf',
    ];

    it('deve identificar corretamente rotas protegidas', () => {
      // Esta função é interna ao middleware, então testamos através do middleware
      protectedPaths.forEach((path) => {
        const request = createMockRequest(path, true);
        middleware(request);
        
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        jest.clearAllMocks();
      });
    });

    it('deve permitir acesso a rotas públicas sem autenticação', () => {
      publicPaths.forEach((path) => {
        const request = createMockRequest(path, false);
        middleware(request);
        
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        jest.clearAllMocks();
      });
    });
  });

  describe('autenticação', () => {
    it('deve permitir acesso a rota protegida com cookie de autenticação', () => {
      const request = createMockRequest('/dashboard', true);
      
      middleware(request);

      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('deve redirecionar para login quando não há cookie de autenticação', () => {
      const request = createMockRequest('/dashboard', false);
      
      middleware(request);

      expect(NextResponse.next).not.toHaveBeenCalled();
      expect(NextResponse.redirect).toHaveBeenCalled();
      
      const redirectCall = (NextResponse.redirect as jest.Mock).mock.calls[0];
      const redirectUrl = redirectCall[0];
      
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/dashboard');
    });

    it('deve preservar o path original no parâmetro "next"', () => {
      const protectedPaths = [
        '/applications',
        '/documents',
        '/bi/report/123',
        '/admin/users',
      ];

      protectedPaths.forEach((path) => {
        const request = createMockRequest(path, false);
        jest.clearAllMocks();
        
        middleware(request);

        const redirectCall = (NextResponse.redirect as jest.Mock).mock.calls[0];
        const redirectUrl = redirectCall[0];
        
        expect(redirectUrl.searchParams.get('next')).toBe(path);
      });
    });

    it('deve verificar presença do cookie cv_auth', () => {
      const request = createMockRequest('/dashboard', false);
      
      middleware(request);

      expect(request.cookies.get).toHaveBeenCalledWith('cv_auth');
    });
  });

  describe('rotas específicas', () => {
    it('deve permitir acesso à página de login sem autenticação', () => {
      const request = createMockRequest('/login', false);
      
      middleware(request);

      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('deve permitir acesso à home sem autenticação', () => {
      const request = createMockRequest('/', false);
      
      middleware(request);

      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('deve proteger todas as subrotas de /admin', () => {
      const adminPaths = [
        '/admin',
        '/admin/users',
        '/admin/users/123',
        '/admin/settings',
        '/admin/settings/general',
      ];

      adminPaths.forEach((path) => {
        const requestWithAuth = createMockRequest(path, true);
        const requestWithoutAuth = createMockRequest(path, false);
        
        jest.clearAllMocks();
        middleware(requestWithAuth);
        expect(NextResponse.next).toHaveBeenCalled();
        
        jest.clearAllMocks();
        middleware(requestWithoutAuth);
        expect(NextResponse.redirect).toHaveBeenCalled();
      });
    });

    it('deve proteger todas as subrotas de /dashboard', () => {
      const dashboardPaths = [
        '/dashboard',
        '/dashboard/contacts',
        '/dashboard/reports',
        '/dashboard/reports/monthly',
      ];

      dashboardPaths.forEach((path) => {
        const requestWithAuth = createMockRequest(path, true);
        const requestWithoutAuth = createMockRequest(path, false);
        
        jest.clearAllMocks();
        middleware(requestWithAuth);
        expect(NextResponse.next).toHaveBeenCalled();
        
        jest.clearAllMocks();
        middleware(requestWithoutAuth);
        expect(NextResponse.redirect).toHaveBeenCalled();
      });
    });
  });

  describe('ignorar arquivos estáticos', () => {
    it('não deve processar arquivos estáticos do Next.js', () => {
      const staticPaths = [
        '/_next/static/css/app.css',
        '/_next/static/chunks/main.js',
        '/_next/image',
        '/favicon.ico',
      ];

      staticPaths.forEach((path) => {
        // O middleware não será chamado para esses paths devido ao matcher config
        // mas se for chamado, eles não são rotas protegidas
        const request = createMockRequest(path, false);
        jest.clearAllMocks();
        
        middleware(request);

        expect(NextResponse.next).toHaveBeenCalled();
      });
    });
  });
});

// Helper para criar mock de request
function createMockRequest(pathname: string, hasAuthCookie: boolean): any {
  const mockCookies = {
    get: jest.fn((name) => {
      if (name === 'cv_auth' && hasAuthCookie) {
        return { value: 'authenticated' };
      }
      return undefined;
    }),
  };

  return {
    nextUrl: {
      pathname,
    },
    url: 'http://localhost:3000',
    cookies: mockCookies,
  };
}

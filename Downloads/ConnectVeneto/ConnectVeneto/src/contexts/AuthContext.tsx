
"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseApp, googleProvider } from '@/lib/firebase';
import { getAuth, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { Collaborator, CollaboratorPermissions, getCollaboratorUserId } from './CollaboratorsContext';
import { addDocumentToCollection, getCollection, updateDocumentInCollection as updateFirestoreDoc } from '@/lib/firestore-service';
import { useCollaboratorSync } from '@/hooks/useCollaboratorSync';
import type { FirebaseError } from 'firebase/app';
import { normalizeEmail } from '@/lib/email-utils';
import { bootstrapTrace, resetBootstrapTrace } from '@/lib/bootstrap-trace';
import { fetchClientSessionInfo, type ClientSessionInfo } from '@/lib/session-client';

/** Drive ainda usa OAuth no widget de arquivos; calendário passou a API pública via /api/calendar. */
const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
scopes.forEach(scope => googleProvider.addScope(scope));
googleProvider.setCustomParameters({
  hd: 'venetomfo.com.br',
  prompt: 'select_account',
});

const CORPORATE_EMAIL_DOMAIN = 'venetomfo.com.br';
const AUTH_COOKIE_NAME = 'cv_auth';
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 24h
const GOOGLE_ACCESS_TOKEN_STORAGE_KEY = 'cv_google_access_token';
const GOOGLE_ACCESS_TOKEN_ISSUED_AT_KEY = 'cv_google_access_token_issued_at';
const GOOGLE_ACCESS_TOKEN_MAX_AGE_MS = 55 * 60 * 1000; // 55 minutos para margem de expiração

interface AuthContextType {
  user: User | null;
  currentUserCollab: Collaborator | null;
  loading: boolean;
  isAdmin: boolean; 
  isSuperAdmin: boolean;
  permissions: CollaboratorPermissions;
  accessToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Instâncias singleton fora do componente para garantir referência estável entre renders
const _firebaseApp = getFirebaseApp();
const _auth = getAuth(_firebaseApp);

const isCorporateEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return normalizeEmail(email)?.endsWith(`@${CORPORATE_EMAIL_DOMAIN}`) ?? false;
}

const setAuthSessionCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
};

const clearAuthSessionCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
};

const saveGoogleAccessToken = (token: string) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GOOGLE_ACCESS_TOKEN_STORAGE_KEY, token);
  window.sessionStorage.setItem(GOOGLE_ACCESS_TOKEN_ISSUED_AT_KEY, Date.now().toString());
};

const clearGoogleAccessToken = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GOOGLE_ACCESS_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(GOOGLE_ACCESS_TOKEN_ISSUED_AT_KEY);
};

const restoreGoogleAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = window.sessionStorage.getItem(GOOGLE_ACCESS_TOKEN_STORAGE_KEY);
  const issuedAtRaw = window.sessionStorage.getItem(GOOGLE_ACCESS_TOKEN_ISSUED_AT_KEY);
  const issuedAt = issuedAtRaw ? Number(issuedAtRaw) : NaN;

  if (!token || Number.isNaN(issuedAt)) {
    clearGoogleAccessToken();
    return null;
  }

  const age = Date.now() - issuedAt;
  if (age > GOOGLE_ACCESS_TOKEN_MAX_AGE_MS) {
    clearGoogleAccessToken();
    return null;
  }

  return token;
};

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

const defaultPermissions: CollaboratorPermissions = {
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
};

const adminPermissionKeys: Array<keyof CollaboratorPermissions> = [
  'canManageWorkflows',
  'canManageRequests',
  'canManageContent',
  'canManageTripsBirthdays',
  'canManageVacation',
  'canViewAudit',
  'canManageSystem',
  'canViewTasks',
  'canViewBI',
  'canViewCRM',
  'canViewStrategicPanel',
  'canViewOpportunityMap',
  'canViewMeetAnalyses',
  'canViewDirectoria',
];


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => _auth.currentUser);
  const [currentUserCollab, setCurrentUserCollab] = useState<Collaborator | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !_auth.currentUser);
  const [permissions, setPermissions] = useState<CollaboratorPermissions>(defaultPermissions);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  
  const auth = _auth;
  const authBootstrapCompletedRef = useRef(false);

  useEffect(() => {
    resetBootstrapTrace();
    bootstrapTrace('auth_provider_mount', { hasCachedUser: !!_auth.currentUser });
  }, []);

  useEffect(() => {
    const restoredToken = restoreGoogleAccessToken();
    if (restoredToken) {
      setAccessToken(restoredToken);
    }
  }, []);

  const applyCollaboratorState = useCallback((collaborator: Collaborator | null) => {
    if (collaborator) {
      setCurrentUserCollab(collaborator);
      const userPermissions = { ...defaultPermissions, ...(collaborator.permissions || {}) };
      setPermissions(userPermissions);
      setIsAdmin(adminPermissionKeys.some((key) => userPermissions[key] === true));
    } else {
      setCurrentUserCollab(null);
      setPermissions(defaultPermissions);
      setIsAdmin(false);
    }
  }, []);

  const fetchAndSetCollaborator = useCallback(async (firebaseUser: User): Promise<Collaborator | null> => {
    const collaborators = await getCollection<Collaborator>('collaborators');
    let collaborator: Collaborator | null = collaborators.find(c => c.authUid === firebaseUser.uid) ?? null;

    if (!collaborator) {
      const normalizedEmail = normalizeEmail(firebaseUser.email);
      const collaboratorByEmail = collaborators.find(c => normalizeEmail(c.email) === normalizedEmail) ?? null;

      if (collaboratorByEmail) {
        await updateFirestoreDoc('collaborators', collaboratorByEmail.id, { authUid: firebaseUser.uid });
        collaborator = { ...collaboratorByEmail, authUid: firebaseUser.uid };
      }
    }
    
    applyCollaboratorState(collaborator || null);
    return collaborator;
  }, [applyCollaboratorState]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      bootstrapTrace('onAuthStateChanged_fired', {
        hasFirebaseUser: !!firebaseUser,
        uid: firebaseUser?.uid ?? null,
      });
      if (!authBootstrapCompletedRef.current) {
        setLoading(true);
        bootstrapTrace('auth_loading_true');
      }
      if (firebaseUser) {
        try {
            if (!isCorporateEmail(firebaseUser.email)) {
              await firebaseSignOut(auth);
              clearAuthSessionCookie();
              setUser(null);
              setCurrentUserCollab(null);
              toast({
                title: "Acesso Negado",
                description: `Apenas contas @${CORPORATE_EMAIL_DOMAIN} podem acessar a plataforma.`,
                variant: 'destructive'
              });
              setLoading(false);
              return;
            }

            // Decisoes de privilegio/manutencao sao sempre server-side.
            // Falha de /api/me/session deve ser fail-closed.
            const serverSession: ClientSessionInfo | null = await fetchClientSessionInfo(firebaseUser);
            if (!serverSession) {
              await firebaseSignOut(auth);
              clearAuthSessionCookie();
              setUser(null);
              setCurrentUserCollab(null);
              setIsSuperAdmin(false);
              setIsAdmin(false);
              toast({
                title: "Sessão indisponível",
                description: "Não foi possível validar sua sessão agora. Tente novamente em instantes.",
                variant: "destructive",
              });
              setLoading(false);
              return;
            }
            const { maintenanceMode, maintenanceMessage, isAllowedDuringMaintenance } = serverSession;
            const isSuper = serverSession.isSuperAdmin;

            let collaborator: Collaborator | null = null;
            let collaboratorLookupTimedOut = false;
            try {
              bootstrapTrace('collaborator_lookup_start');
              collaborator = await withTimeout(fetchAndSetCollaborator(firebaseUser), 8000);
              bootstrapTrace('collaborator_lookup_success', { hasCollaborator: !!collaborator });
            } catch (lookupError) {
              if (lookupError instanceof Error && lookupError.message === 'AUTH_LOOKUP_TIMEOUT') {
                collaboratorLookupTimedOut = true;
                bootstrapTrace('collaborator_lookup_timeout');
              } else {
                bootstrapTrace('collaborator_lookup_error', {
                  error: lookupError instanceof Error ? lookupError.message : 'unknown',
                });
                throw lookupError;
              }
            }

            if (maintenanceMode && !isSuper && !isAllowedDuringMaintenance && !collaboratorLookupTimedOut) {
                await firebaseSignOut(auth);
                clearAuthSessionCookie();
                setUser(null);
                setCurrentUserCollab(null);
                toast({ title: "Manutenção", description: maintenanceMessage, duration: 9000 });
            } else if (!collaborator && !isSuper && !collaboratorLookupTimedOut) {
                 await firebaseSignOut(auth);
                 clearAuthSessionCookie();
                 setUser(null);
                 setCurrentUserCollab(null);
                 toast({ title: "Acesso Negado", description: "Seu perfil não foi encontrado na base de dados de colaboradores.", variant: 'destructive' });
            } else {
                setAuthSessionCookie();
                setUser(firebaseUser);
                const restoredToken = restoreGoogleAccessToken();
                setAccessToken(restoredToken);
                setIsSuperAdmin(isSuper);
                if (collaboratorLookupTimedOut) {
                  bootstrapTrace('auth_release_on_timeout');
                  toast({
                    title: "Sincronizando seu perfil",
                    description: "Seu acesso já foi liberado. Alguns dados podem aparecer em instantes.",
                    duration: 3500,
                  });
                }
                if (isSuper) {
                    const allPermissions = Object.keys(defaultPermissions).reduce((acc, key) => {
                        acc[key as keyof CollaboratorPermissions] = true;
                        return acc;
                    }, {} as CollaboratorPermissions);
                    setPermissions(allPermissions);
                    setIsAdmin(true);
                }
            }
        } catch (e) {
             bootstrapTrace('auth_state_error', {
               error: e instanceof Error ? e.message : 'unknown',
             });
             console.error("Error during auth state change verification:", e);
             await firebaseSignOut(auth);
             clearAuthSessionCookie();
             setUser(null);
             toast({ title: "Erro de Configuração", description: "Não foi possível verificar as configurações do sistema.", variant: 'destructive' });
        }
      } else {
        bootstrapTrace('auth_state_without_user');
        clearAuthSessionCookie();
        clearGoogleAccessToken();
        setUser(null);
        setCurrentUserCollab(null);
        setAccessToken(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setPermissions(defaultPermissions);
      }
      authBootstrapCompletedRef.current = true;
      bootstrapTrace('auth_loading_false', { hasUser: !!firebaseUser });
      setLoading(false); 
    });
    return () => unsubscribe();
  }, [auth, fetchAndSetCollaborator]);

  // Guard rail: avoid infinite spinner if auth bootstrap stalls.
  useEffect(() => {
    if (!loading || authBootstrapCompletedRef.current) return;
    const timeoutId = setTimeout(() => {
      authBootstrapCompletedRef.current = true;
      bootstrapTrace('auth_watchdog_release_loading');
      setLoading(false);
    }, 12000);
    return () => clearTimeout(timeoutId);
  }, [loading]);

  useCollaboratorSync(user, isSuperAdmin, applyCollaboratorState);

  
  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      if (!isCorporateEmail(firebaseUser.email)) {
        await firebaseSignOut(auth);
        clearAuthSessionCookie();
        toast({
          title: "Acesso Negado",
          description: `Apenas contas @${CORPORATE_EMAIL_DOMAIN} podem acessar a plataforma.`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Decisao de privilegio/manutencao e sempre server-side.
      const serverSession: ClientSessionInfo | null = await fetchClientSessionInfo(firebaseUser);
      if (!serverSession) {
        await firebaseSignOut(auth);
        clearAuthSessionCookie();
        toast({
          title: "Sessão indisponível",
          description: "Não foi possível validar sua sessão agora. Tente novamente em instantes.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { maintenanceMode, maintenanceMessage, isAllowedDuringMaintenance } = serverSession;

      const collaborator = await fetchAndSetCollaborator(firebaseUser);
      const isSuper = serverSession.isSuperAdmin;

      if (maintenanceMode) {
          if (!isSuper && !isAllowedDuringMaintenance) {
              await firebaseSignOut(auth);
              toast({ title: "Manutenção em Andamento", description: maintenanceMessage, duration: 9000 });
              setLoading(false);
              return;
          }
      }
      
      if (collaborator || isSuper) {
        setAuthSessionCookie();
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          saveGoogleAccessToken(credential.accessToken);
          setAccessToken(credential.accessToken);
        } else {
          clearGoogleAccessToken();
          setAccessToken(null);
        }
        
        await addDocumentToCollection('audit_logs', {
            eventType: 'login',
            userId: getCollaboratorUserId(collaborator) || firebaseUser.uid,
            userName: collaborator?.name || firebaseUser.displayName || 'Super Admin',
            timestamp: new Date().toISOString(),
            details: {}
        });
        
        router.push('/dashboard');
      } else {
        await firebaseSignOut(auth);
        clearAuthSessionCookie();
        clearGoogleAccessToken();
        setAccessToken(null);
        toast({
            title: "Acesso Negado",
            description: "Seu e-mail não foi encontrado na lista de colaboradores.",
            variant: "destructive"
        });
      }
    } catch (error: unknown) {
      const firebaseError = error as FirebaseError | undefined;
      if (firebaseError?.code) {
        if (firebaseError.code !== 'auth/popup-closed-by-user' && firebaseError.code !== 'auth/cancelled-popup-request') {
          console.error("Firebase Login Error:", firebaseError);
          toast({
            title: "Erro de Login",
            description: `Código: ${firebaseError.code}. Mensagem: ${firebaseError.message}`,
            variant: "destructive",
          });
        }
      } else {
        console.error("Error signing in with Google: ", error);
        toast({
          title: "Erro de Login",
          description: "Ocorreu um problema desconhecido durante o login.",
          variant: "destructive",
        });
      }
    } finally {
        setLoading(false);
    }
  }, [auth, fetchAndSetCollaborator, router]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      clearAuthSessionCookie();
      clearGoogleAccessToken();
      setAccessToken(null);
      setCurrentUserCollab(null);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      throw error;
    }
  }, [auth, router]);
  
  const value = useMemo(() => ({
      user,
      currentUserCollab,
      loading,
      isAdmin,
      isSuperAdmin,
      permissions,
      accessToken,
      signInWithGoogle,
      signOut,
  }), [user, currentUserCollab, loading, isAdmin, isSuperAdmin, permissions, accessToken, signInWithGoogle, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

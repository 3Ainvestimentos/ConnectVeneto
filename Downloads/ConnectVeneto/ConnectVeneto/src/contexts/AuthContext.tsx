
"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseApp, googleProvider } from '@/lib/firebase';
import { getAuth, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { Collaborator, CollaboratorPermissions, getCollaboratorUserId } from './CollaboratorsContext';
import { addDocumentToCollection, getCollection, updateDocumentInCollection as updateFirestoreDoc } from '@/lib/firestore-service';
import { useSystemSettings } from './SystemSettingsContext';
import { getFirestore, collection, onSnapshot, query, where } from "firebase/firestore";
import type { FirebaseError } from 'firebase/app';
import { normalizeEmail } from '@/lib/email-utils';

const scopes = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
];
scopes.forEach(scope => googleProvider.addScope(scope));
googleProvider.setCustomParameters({
  hd: 'venetomfo.com.br',
  prompt: 'select_account',
});

const CORPORATE_EMAIL_DOMAIN = 'venetomfo.com.br';

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

const defaultPermissions: CollaboratorPermissions = {
  canManageWorkflows: false,
  canManageRequests: false,
  canManageContent: false,
  canManageTripsBirthdays: false,
  canManageVacation: false,
  canViewTasks: false,
  canViewBI: false,
  canViewRankings: false,
  canViewCRM: false,
  canViewStrategicPanel: false,
  canViewOpportunityMap: false,
  canViewMeetAnalyses: false,
  canViewDirectoria: false,
  canViewBILeaders: false,
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserCollab, setCurrentUserCollab] = useState<Collaborator | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<CollaboratorPermissions>(defaultPermissions);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const { settings: systemSettings } = useSystemSettings();
  
  const auth = _auth;

  const systemSettingsRef = useRef(systemSettings);
  useEffect(() => {
    systemSettingsRef.current = systemSettings;
  }, [systemSettings]);

  const logAuthDebug = useCallback((label: string, extra?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    const context = {
      origin: window.location.origin,
      referrer: document.referrer,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      pathname: window.location.pathname,
    };
    // eslint-disable-next-line no-console
    console.info(`[AuthDebug] ${label}`, { ...context, ...extra });
  }, []);

  const applyCollaboratorState = useCallback((collaborator: Collaborator | null) => {
    if (collaborator) {
      setCurrentUserCollab(collaborator);
      const userPermissions = { ...defaultPermissions, ...(collaborator.permissions || {}) };
      setPermissions(userPermissions);
      setIsAdmin(Object.values(userPermissions).some(p => p === true));
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
        console.log(`Associating authUid for ${normalizedEmail}...`);
        await updateFirestoreDoc('collaborators', collaboratorByEmail.id, { authUid: firebaseUser.uid });
        collaborator = { ...collaboratorByEmail, authUid: firebaseUser.uid };
      }
    }
    
    applyCollaboratorState(collaborator || null);
    return collaborator;
  }, [applyCollaboratorState]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
            if (!isCorporateEmail(firebaseUser.email)) {
              await firebaseSignOut(auth);
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

            const { maintenanceMode, maintenanceMessage, allowedUserIds, superAdminEmails } = systemSettingsRef.current;
            const normalizedEmail = normalizeEmail(firebaseUser.email);
            // Normaliza também os emails da lista para comparar corretamente
            const normalizedAdminEmails = superAdminEmails.map(email => normalizeEmail(email)).filter((email): email is string => email !== null);
            const isSuper = !!normalizedEmail && (normalizedAdminEmails.includes(normalizedEmail) || superAdminEmails.includes(normalizedEmail));
            
            const collaborator = await fetchAndSetCollaborator(firebaseUser);

            const collaboratorUserId = getCollaboratorUserId(collaborator);
            const isAllowedDuringMaintenance = collaboratorUserId ? allowedUserIds.includes(collaboratorUserId) : false;

            if (maintenanceMode && !isSuper && !isAllowedDuringMaintenance) {
                await firebaseSignOut(auth);
                setUser(null);
                setCurrentUserCollab(null);
                toast({ title: "Manutenção", description: maintenanceMessage, duration: 9000 });
            } else if (!collaborator && !isSuper) {
                 await firebaseSignOut(auth);
                 setUser(null);
                 setCurrentUserCollab(null);
                 toast({ title: "Acesso Negado", description: "Seu perfil não foi encontrado na base de dados de colaboradores.", variant: 'destructive' });
            } else {
                setUser(firebaseUser);
                setIsSuperAdmin(isSuper);
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
             console.error("Error during auth state change verification:", e);
             await firebaseSignOut(auth);
             setUser(null);
             toast({ title: "Erro de Configuração", description: "Não foi possível verificar as configurações do sistema.", variant: 'destructive' });
        }
      } else {
        setUser(null);
        setCurrentUserCollab(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setPermissions(defaultPermissions);
      }
      setLoading(false); 
    });
    return () => unsubscribe();
  }, [auth, fetchAndSetCollaborator]);

  useEffect(() => {
    if (!user || isSuperAdmin) return;

    const db = getFirestore(getFirebaseApp());
    const collaboratorsRef = collection(db, 'collaborators');
    const emailCandidates = Array.from(
      new Set([user.email, normalizeEmail(user.email)].filter((email): email is string => !!email))
    );

    let collaboratorFromUid: Collaborator | null = null;

    const unsubByUid = onSnapshot(
      query(collaboratorsRef, where('authUid', '==', user.uid)),
      (snapshot) => {
        const docSnap = snapshot.docs[0];
        collaboratorFromUid = docSnap ? ({ id: docSnap.id, ...docSnap.data() } as Collaborator) : null;
        if (collaboratorFromUid) {
          applyCollaboratorState(collaboratorFromUid);
        }
      },
      (error) => {
        console.error('Auth realtime sync by authUid failed:', error);
      }
    );

    let unsubByEmail = () => {};
    if (emailCandidates.length > 0) {
      unsubByEmail = onSnapshot(
        query(collaboratorsRef, where('email', 'in', emailCandidates)),
        (snapshot) => {
          if (collaboratorFromUid) return;
          const docSnap = snapshot.docs[0];
          if (docSnap) {
            applyCollaboratorState({ id: docSnap.id, ...docSnap.data() } as Collaborator);
          }
        },
        (error) => {
          console.error('Auth realtime sync by email failed:', error);
        }
      );
    }

    return () => {
      unsubByUid();
      unsubByEmail();
    };
  }, [user, isSuperAdmin, applyCollaboratorState]);

  
  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const { maintenanceMode, maintenanceMessage, allowedUserIds, superAdminEmails } = systemSettings;
      
      logAuthDebug('signInWithGoogle:start');
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      if (!isCorporateEmail(firebaseUser.email)) {
        await firebaseSignOut(auth);
        toast({
          title: "Acesso Negado",
          description: `Apenas contas @${CORPORATE_EMAIL_DOMAIN} podem acessar a plataforma.`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      const collaborator = await fetchAndSetCollaborator(firebaseUser);
      const normalizedEmail = normalizeEmail(firebaseUser.email);
      // Normaliza também os emails da lista para comparar corretamente
      const normalizedAdminEmails = superAdminEmails.map(email => normalizeEmail(email)).filter((email): email is string => email !== null);
      const isSuper = !!normalizedEmail && (normalizedAdminEmails.includes(normalizedEmail) || superAdminEmails.includes(normalizedEmail));

      if (maintenanceMode) {
          const collaboratorUserId = getCollaboratorUserId(collaborator);
          const isAllowedDuringMaintenance = !!collaboratorUserId && (allowedUserIds || []).includes(collaboratorUserId);
          if (!isSuper && !isAllowedDuringMaintenance) {
              await firebaseSignOut(auth);
              toast({ title: "Manutenção em Andamento", description: maintenanceMessage, duration: 9000 });
              setLoading(false);
              return;
          }
      }
      
      if (collaborator || isSuper) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setAccessToken(credential.accessToken);
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
          logAuthDebug('signInWithGoogle:error', {
            code: firebaseError.code,
            message: firebaseError.message,
            customData: firebaseError.customData,
          });
          // eslint-disable-next-line no-console
          console.error("Firebase Login Error:", firebaseError);
          toast({
            title: "Erro de Login",
            description: `Código: ${firebaseError.code}. Mensagem: ${firebaseError.message}`,
            variant: "destructive",
          });
        }
      } else {
        logAuthDebug('signInWithGoogle:unknown-error', { error });
        // eslint-disable-next-line no-console
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
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setAccessToken(null);
      setCurrentUserCollab(null);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      throw error;
    }
  };
  
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

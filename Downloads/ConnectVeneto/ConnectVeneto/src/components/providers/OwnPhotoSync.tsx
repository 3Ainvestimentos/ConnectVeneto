"use client";

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const FLAG = 'cv_photo_synced';

/**
 * Leva a foto da conta Google para o cadastro (`POST /api/me/photo`) quando o cadastro está sem foto
 * ou com outra foto do Google. Uma tentativa por sessão do navegador; falha não incomoda ninguém.
 */
export function OwnPhotoSync() {
  const { user, currentUserCollab } = useAuth();

  useEffect(() => {
    const photo = user?.photoURL;
    if (!user || !currentUserCollab || !photo || currentUserCollab.photoURL === photo) return;
    if (!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//i.test(photo)) return;
    try {
      if (sessionStorage.getItem(FLAG) === user.uid) return;
      sessionStorage.setItem(FLAG, user.uid);
    } catch {
      // Sem sessionStorage (aba privada): tenta mesmo assim, o servidor ignora se já estiver igual.
    }
    void user
      .getIdToken()
      .then((token) => fetch('/api/me/photo', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }))
      .catch(() => undefined);
  }, [user, currentUserCollab]);

  return null;
}

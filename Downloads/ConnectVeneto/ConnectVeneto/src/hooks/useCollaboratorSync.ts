"use client";

import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getClientFirestore } from '@/lib/firebase';
import type { Collaborator } from '@/contexts/CollaboratorsContext';
import { normalizeEmail } from '@/lib/email-utils';

/**
 * Watches Firestore for changes to the logged-in user's collaborator document
 * and invokes `onUpdate` whenever the document changes.
 *
 * Two parallel listeners are used for robustness:
 *  1. By `authUid` — primary, set after first login.
 *  2. By `email`   — fallback for accounts not yet linked to a UID.
 *
 * Only one listener triggers `onUpdate` per change cycle (UID takes priority).
 */
export function useCollaboratorSync(
  user: User | null,
  isSuperAdmin: boolean,
  onUpdate: (collaborator: Collaborator | null) => void
): void {
  useEffect(() => {
    if (!user || isSuperAdmin) return;

    const db = getClientFirestore();
    const collaboratorsRef = collection(db, 'collaborators');
    const emailCandidates = Array.from(
      new Set(
        [user.email, normalizeEmail(user.email)].filter((e): e is string => !!e)
      )
    );

    // Tracks whether the UID listener already resolved to avoid double-calling onUpdate
    let collaboratorFromUid: Collaborator | null = null;

    const unsubByUid = onSnapshot(
      query(collaboratorsRef, where('authUid', '==', user.uid)),
      (snapshot) => {
        const docSnap = snapshot.docs[0];
        collaboratorFromUid = docSnap
          ? ({ id: docSnap.id, ...docSnap.data() } as Collaborator)
          : null;
        if (collaboratorFromUid) {
          onUpdate(collaboratorFromUid);
        }
      },
      (error) => {
        console.error('Collaborator sync by authUid failed:', error);
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
            onUpdate({ id: docSnap.id, ...docSnap.data() } as Collaborator);
          }
        },
        (error) => {
          console.error('Collaborator sync by email failed:', error);
        }
      );
    }

    return () => {
      unsubByUid();
      unsubByEmail();
    };
  }, [user, isSuperAdmin, onUpdate]);
}

"use client";

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCollection,
  listenToCollection,
  setDocumentInCollection,
  deleteDocumentFromCollection,
} from "@/lib/firestore-service";
import { useAuth } from "./AuthContext";
import { useCollaborators } from "./CollaboratorsContext";
import {
  VacationApprover,
  VACATION_APPROVERS_COLLECTION,
  RESPONSIBLE_OPTIONS,
} from "@/types/vacation";

interface ResolvedResponsible {
  name: string;
  authUid: string;
}

interface VacationApproversContextType {
  approvers: VacationApprover[];
  loading: boolean;
  canApproveVacationRequests: boolean;
  resolvedResponsibles: ResolvedResponsible[];
  getResponsibleForUser: (userUid: string) => VacationApprover | undefined;
  setResponsible: (
    collabUid: string,
    collabName: string,
    responsibleUid: string,
    responsibleName: string
  ) => Promise<void>;
  removeResponsible: (collabUid: string) => Promise<void>;
}

const VacationApproversContext = createContext<
  VacationApproversContextType | undefined
>(undefined);

export function VacationApproversProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { user, isSuperAdmin } = useAuth();
  const { collaborators } = useCollaborators();

  const { data: approvers = [], isFetching } = useQuery<VacationApprover[]>({
    queryKey: [VACATION_APPROVERS_COLLECTION],
    queryFn: () => getCollection<VacationApprover>(VACATION_APPROVERS_COLLECTION),
    enabled: !!user,
    staleTime: Infinity,
    retry: false,
  });

  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollection<VacationApprover>(
      VACATION_APPROVERS_COLLECTION,
      (newData) => {
        queryClient.setQueryData(
          [VACATION_APPROVERS_COLLECTION],
          newData as VacationApprover[]
        );
      },
      (error) => {
        console.error("Failed to listen to vacation approvers:", error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);

  const resolvedResponsibles = useMemo(() => {
    return RESPONSIBLE_OPTIONS
      .map((opt) => {
        const collab = collaborators.find(
          (c) => c.name.trim().toLowerCase() === opt.name.trim().toLowerCase()
        );
        if (!collab || !collab.authUid) return null;
        return { name: collab.name, authUid: collab.authUid };
      })
      .filter((r): r is ResolvedResponsible => r !== null);
  }, [collaborators]);

  const setResponsibleMutation = useMutation<
    void,
    Error,
    { collabUid: string; collabName: string; responsibleUid: string; responsibleName: string }
  >({
    mutationFn: async ({ collabUid, collabName, responsibleUid, responsibleName }) => {
      if (!isSuperAdmin) {
        throw new Error("Apenas super administradores podem alterar responsáveis.");
      }
      const now = new Date().toISOString();
      const existing = approvers.find((a) => a.userUid === collabUid);

      await setDocumentInCollection<VacationApprover>(
        VACATION_APPROVERS_COLLECTION,
        collabUid,
        {
          userUid: collabUid,
          userName: collabName,
          responsibleUid,
          responsibleName,
          updatedAt: now,
          updatedByUid: user?.uid ?? "",
          ...(existing ? {} : { createdAt: now }),
        }
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [VACATION_APPROVERS_COLLECTION],
      }),
  });

  const removeResponsibleMutation = useMutation<void, Error, string>({
    mutationFn: async (collabUid) => {
      if (!isSuperAdmin) {
        throw new Error("Apenas super administradores podem remover responsáveis.");
      }
      await deleteDocumentFromCollection(VACATION_APPROVERS_COLLECTION, collabUid);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [VACATION_APPROVERS_COLLECTION],
      }),
  });

  const canApproveVacationRequests = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!user) return false;
    return approvers.some((a) => a.responsibleUid === user.uid);
  }, [approvers, user, isSuperAdmin]);

  const getResponsibleForUser = useCallback(
    (userUid: string) => approvers.find((a) => a.userUid === userUid),
    [approvers]
  );

  const value = useMemo(
    () => ({
      approvers,
      loading: isFetching,
      canApproveVacationRequests,
      resolvedResponsibles,
      getResponsibleForUser,
      setResponsible: (
        collabUid: string,
        collabName: string,
        responsibleUid: string,
        responsibleName: string
      ) =>
        setResponsibleMutation.mutateAsync({
          collabUid,
          collabName,
          responsibleUid,
          responsibleName,
        }),
      removeResponsible: (collabUid: string) =>
        removeResponsibleMutation.mutateAsync(collabUid),
    }),
    [
      approvers,
      isFetching,
      canApproveVacationRequests,
      resolvedResponsibles,
      getResponsibleForUser,
      setResponsibleMutation,
      removeResponsibleMutation,
    ]
  );

  return (
    <VacationApproversContext.Provider value={value}>
      {children}
    </VacationApproversContext.Provider>
  );
}

export function useVacationApprovers() {
  const context = useContext(VacationApproversContext);
  if (!context) {
    throw new Error(
      "useVacationApprovers must be used within a VacationApproversProvider"
    );
  }
  return context;
}

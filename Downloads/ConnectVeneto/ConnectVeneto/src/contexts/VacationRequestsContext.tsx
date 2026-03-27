"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDocumentToCollection,
  listenToCollectionWithQuery,
  updateDocumentInCollection,
} from "@/lib/firestore-service";
import type { FirestoreQueryFilter } from "@/lib/firestore-service";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { useVacationApprovers } from "./VacationApproversContext";
import {
  VacationRequest,
  VacationRequestStatus,
  CreateVacationRequestInput,
  VACATION_REQUESTS_COLLECTION,
} from "@/types/vacation";

const VACATIONS_COLLECTION = "vacations";
const TOTAL_VACATION_DAYS = 22;

type ViewMode = "all" | "responsible" | "own";

interface VacationRequestsContextType {
  requests: VacationRequest[];
  pendingRequests: VacationRequest[];
  approvedRequests: VacationRequest[];
  rejectedRequests: VacationRequest[];
  loading: boolean;
  createRequest: (input: CreateVacationRequestInput) => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string, reason?: string) => Promise<void>;
  archiveRejectedRequest: (requestId: string) => Promise<void>;
}

const VacationRequestsContext = createContext<
  VacationRequestsContextType | undefined
>(undefined);

function filterByStatus(
  requests: VacationRequest[],
  status: VacationRequestStatus
) {
  return requests.filter((r) => r.status === status);
}

function deduplicateAndSort(items: VacationRequest[]): VacationRequest[] {
  const map = new Map<string, VacationRequest>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function VacationRequestsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { user, currentUserCollab, isSuperAdmin } = useAuth();
  const { canApproveVacationRequests, getResponsibleForUser } =
    useVacationApprovers();

  const viewMode: ViewMode = isSuperAdmin
    ? "all"
    : canApproveVacationRequests
      ? "responsible"
      : "own";

  const [ownRequests, setOwnRequests] = React.useState<VacationRequest[]>([]);
  const [assignedRequests, setAssignedRequests] = React.useState<
    VacationRequest[]
  >([]);
  const [allRequests, setAllRequests] = React.useState<VacationRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setOwnRequests([]);
      setAssignedRequests([]);
      setAllRequests([]);
      setLoading(false);
      return;
    }

    const unsubscribers: (() => void)[] = [];

    if (viewMode === "all") {
      const unsub = listenToCollectionWithQuery<VacationRequest>(
        VACATION_REQUESTS_COLLECTION,
        (data) => {
          setAllRequests(data as VacationRequest[]);
          setLoading(false);
        },
        (error) => {
          console.error("Failed to listen to all vacation requests:", error);
          setLoading(false);
        }
      );
      unsubscribers.push(unsub);
    } else {
      const ownFilter: FirestoreQueryFilter[] = [
        { field: "requesterUid", operator: "==", value: user.uid },
      ];
      const unsubOwn = listenToCollectionWithQuery<VacationRequest>(
        VACATION_REQUESTS_COLLECTION,
        (data) => {
          setOwnRequests(data as VacationRequest[]);
          setLoading(false);
        },
        (error) => {
          console.error("Failed to listen to own vacation requests:", error);
          setLoading(false);
        },
        ownFilter
      );
      unsubscribers.push(unsubOwn);

      if (viewMode === "responsible") {
        const assignedFilter: FirestoreQueryFilter[] = [
          { field: "responsibleUid", operator: "==", value: user.uid },
        ];
        const unsubAssigned = listenToCollectionWithQuery<VacationRequest>(
          VACATION_REQUESTS_COLLECTION,
          (data) => {
            setAssignedRequests(data as VacationRequest[]);
            setLoading(false);
          },
          (error) => {
            console.error(
              "Failed to listen to assigned vacation requests:",
              error
            );
            setLoading(false);
          },
          assignedFilter
        );
        unsubscribers.push(unsubAssigned);
      } else {
        setAssignedRequests([]);
      }
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, viewMode]);

  const requests = useMemo(() => {
    if (viewMode === "all") {
      return deduplicateAndSort(allRequests);
    }
    return deduplicateAndSort([...ownRequests, ...assignedRequests]);
  }, [viewMode, allRequests, ownRequests, assignedRequests]);

  const createRequestMutation = useMutation<
    void,
    Error,
    CreateVacationRequestInput
  >({
    mutationFn: async (input) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const requesterName =
        currentUserCollab?.name?.trim() ||
        user.displayName?.trim() ||
        user.email?.trim() ||
        "Desconhecido";

      const responsible = getResponsibleForUser(user.uid);

      const now = new Date().toISOString();
      await addDocumentToCollection(VACATION_REQUESTS_COLLECTION, {
        requesterUid: user.uid,
        requesterName,
        startDate: input.startDate,
        endDate: input.endDate,
        businessDays: input.businessDays,
        status: "pending" as const,
        responsibleUid: responsible?.responsibleUid ?? "",
        responsibleName: responsible?.responsibleName ?? "",
        createdAt: now,
        updatedAt: now,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [VACATION_REQUESTS_COLLECTION],
      }),
  });

  const approveRequestMutation = useMutation<void, Error, string>({
    mutationFn: async (requestId) => {
      if (!isSuperAdmin && !canApproveVacationRequests) {
        throw new Error("Sem permissão para aprovar solicitações.");
      }

      const db = getClientFirestore();
      const requestRef = doc(db, VACATION_REQUESTS_COLLECTION, requestId);
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) {
        throw new Error("Solicitação não encontrada.");
      }

      const requestData = requestSnap.data() as Omit<VacationRequest, "id">;
      if (requestData.status !== "pending") {
        throw new Error("Esta solicitação já foi processada.");
      }

      if (
        !isSuperAdmin &&
        requestData.responsibleUid &&
        requestData.responsibleUid !== user?.uid
      ) {
        throw new Error(
          "Você não é o responsável designado para esta solicitação."
        );
      }

      const vacationsRef = collection(db, VACATIONS_COLLECTION);
      const allVacations = await getDocs(
        query(
          vacationsRef,
          where("collaboratorUid", "==", requestData.requesterUid)
        )
      );

      const requestYear = new Date(requestData.startDate).getFullYear();
      let usedDays = 0;
      allVacations.forEach((vacDoc) => {
        const vac = vacDoc.data();
        const vacYear = new Date(vac.startDate).getFullYear();
        if (vacYear === requestYear) {
          usedDays += Math.max(0, Number(vac.businessDays || 0));
        }
      });

      if (usedDays + requestData.businessDays > TOTAL_VACATION_DAYS) {
        throw new Error(
          `Saldo insuficiente. Disponível: ${TOTAL_VACATION_DAYS - usedDays} dias. Solicitado: ${requestData.businessDays} dias.`
        );
      }

      const requestStart = new Date(requestData.startDate).getTime();
      const requestEnd = new Date(requestData.endDate).getTime();
      let hasConflict = false;
      allVacations.forEach((vacDoc) => {
        const vac = vacDoc.data();
        const vacStart = new Date(vac.startDate).getTime();
        const vacEnd = new Date(vac.endDate).getTime();
        if (requestStart <= vacEnd && requestEnd >= vacStart) {
          hasConflict = true;
        }
      });

      if (hasConflict) {
        throw new Error(
          "Conflito de datas: já existe férias registrada neste período."
        );
      }

      const reviewerName = getReviewerName();
      const vacationRef = doc(db, VACATIONS_COLLECTION, requestId);

      await runTransaction(db, async (transaction) => {
        const latestRequestSnap = await transaction.get(requestRef);
        if (!latestRequestSnap.exists()) {
          throw new Error("Solicitação não encontrada.");
        }
        const latestRequest = latestRequestSnap.data() as Omit<
          VacationRequest,
          "id"
        >;
        if (latestRequest.status !== "pending") {
          throw new Error("Esta solicitação já foi processada.");
        }

        const existingVacationSnap = await transaction.get(vacationRef);
        const now = new Date().toISOString();

        if (!existingVacationSnap.exists()) {
          transaction.set(vacationRef, {
            collaboratorUid: latestRequest.requesterUid,
            collaboratorName: latestRequest.requesterName,
            startDate: latestRequest.startDate,
            endDate: latestRequest.endDate,
            businessDays: latestRequest.businessDays,
            sourceRequestId: requestId,
            createdAt: now,
            updatedAt: now,
          });
        }

        transaction.update(requestRef, {
          status: "approved",
          reviewedByUid: user?.uid ?? "",
          reviewedByName: reviewerName,
          reviewedAt: now,
          updatedAt: now,
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [VACATION_REQUESTS_COLLECTION],
      });
      queryClient.invalidateQueries({
        queryKey: [VACATIONS_COLLECTION],
      });
    },
  });

  const rejectRequestMutation = useMutation<
    void,
    Error,
    { requestId: string; reason?: string }
  >({
    mutationFn: async ({ requestId, reason }) => {
      if (!isSuperAdmin && !canApproveVacationRequests) {
        throw new Error("Sem permissão para reprovar solicitações.");
      }

      const request = requests.find((r) => r.id === requestId);
      if (!request) throw new Error("Solicitação não encontrada.");
      if (request.status !== "pending") {
        throw new Error("Esta solicitação já foi processada.");
      }

      if (
        !isSuperAdmin &&
        request.responsibleUid &&
        request.responsibleUid !== user?.uid
      ) {
        throw new Error(
          "Você não é o responsável designado para esta solicitação."
        );
      }

      const now = new Date().toISOString();
      await updateDocumentInCollection(
        VACATION_REQUESTS_COLLECTION,
        requestId,
        {
          status: "rejected",
          reviewedByUid: user?.uid ?? "",
          reviewedByName: getReviewerName(),
          reviewedAt: now,
          reviewReason: reason || "",
          updatedAt: now,
        }
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [VACATION_REQUESTS_COLLECTION],
      }),
  });

  const archiveRejectedRequestMutation = useMutation<void, Error, string>({
    mutationFn: async (requestId) => {
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }
      const request = requests.find((r) => r.id === requestId);
      if (!request) {
        throw new Error("Solicitação não encontrada.");
      }
      if (request.requesterUid !== user.uid) {
        throw new Error("Você só pode arquivar suas próprias solicitações.");
      }
      if (request.status !== "rejected") {
        throw new Error("Apenas solicitações reprovadas podem ser arquivadas.");
      }
      if (request.requesterArchivedAt) {
        return;
      }

      const now = new Date().toISOString();
      await updateDocumentInCollection(
        VACATION_REQUESTS_COLLECTION,
        requestId,
        {
          requesterArchivedAt: now,
          requesterArchivedByUid: user.uid,
          updatedAt: now,
        }
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [VACATION_REQUESTS_COLLECTION],
      }),
  });

  function getReviewerName() {
    return (
      currentUserCollab?.name?.trim() ||
      user?.displayName?.trim() ||
      user?.email?.trim() ||
      "Desconhecido"
    );
  }

  const pendingRequests = useMemo(
    () => filterByStatus(requests, "pending"),
    [requests]
  );
  const approvedRequests = useMemo(
    () => filterByStatus(requests, "approved"),
    [requests]
  );
  const rejectedRequests = useMemo(
    () => filterByStatus(requests, "rejected"),
    [requests]
  );

  const value = useMemo(
    () => ({
      requests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      loading,
      createRequest: (input: CreateVacationRequestInput) =>
        createRequestMutation.mutateAsync(input),
      approveRequest: (requestId: string) =>
        approveRequestMutation.mutateAsync(requestId),
      rejectRequest: (requestId: string, reason?: string) =>
        rejectRequestMutation.mutateAsync({ requestId, reason }),
      archiveRejectedRequest: (requestId: string) =>
        archiveRejectedRequestMutation.mutateAsync(requestId),
    }),
    [
      requests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      loading,
      createRequestMutation,
      approveRequestMutation,
      rejectRequestMutation,
      archiveRejectedRequestMutation,
    ]
  );

  return (
    <VacationRequestsContext.Provider value={value}>
      {children}
    </VacationRequestsContext.Provider>
  );
}

export function useVacationRequests() {
  const context = useContext(VacationRequestsContext);
  if (!context) {
    throw new Error(
      "useVacationRequests must be used within a VacationRequestsProvider"
    );
  }
  return context;
}

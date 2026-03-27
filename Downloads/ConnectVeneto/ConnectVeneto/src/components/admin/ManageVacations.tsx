"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useVacation } from "@/contexts/VacationContext";
import { useVacationRequests } from "@/contexts/VacationRequestsContext";
import { useVacationApprovers } from "@/contexts/VacationApproversContext";
import { useAuth } from "@/contexts/AuthContext";
import { calculateBusinessDays, fetchHolidays, HolidayItem } from "@/lib/holidays";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PlusCircle, Trash2, Edit, CalendarRange, CalendarCheck, CalendarClock, CheckCircle2, XCircle, Clock, History, Archive } from "lucide-react";
import { DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import type { VacationRequest } from "@/types/vacation";

function formatIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

function doesOverlap(
  startDate: Date,
  endDate: Date,
  existing: { id: string; startDate: string; endDate: string }[],
  ignoreId?: string
) {
  const startMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const endMs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

  return existing.some((vacation) => {
    if (ignoreId && vacation.id === ignoreId) return false;
    const existingStart = new Date(`${vacation.startDate}T00:00:00`).getTime();
    const existingEnd = new Date(`${vacation.endDate}T00:00:00`).getTime();
    return startMs <= existingEnd && endMs >= existingStart;
  });
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  approved: { label: "Aprovada", variant: "default" },
  rejected: { label: "Reprovada", variant: "destructive" },
};

export default function ManageVacations() {
  const { currentUserCollab, user, isSuperAdmin } = useAuth();
  const { vacations, totalDays, usedDays, remainingDays, addVacation, updateVacation, deleteVacationMutation } = useVacation();
  const { requests, pendingRequests, approvedRequests, createRequest, approveRequest, rejectRequest, archiveRejectedRequest } = useVacationRequests();
  const { canApproveVacationRequests } = useVacationApprovers();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidaysByYear, setHolidaysByYear] = useState<Record<number, HolidayItem[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [collaboratorFilter, setCollaboratorFilter] = useState<string>("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const canUseAdminFilter = isSuperAdmin;
  const isRequestMode = !isSuperAdmin;

  const now = new Date();
  const currentYear = now.getFullYear();

  useEffect(() => {
    let mounted = true;
    const loadCurrentYear = async () => {
      try {
        setLoadingHolidays(true);
        const holidays = await fetchHolidays({ year: currentYear });
        if (!mounted) return;
        setHolidaysByYear((prev) => ({ ...prev, [currentYear]: holidays }));
      } catch (error) {
        toast({
          title: "Erro ao carregar feriados",
          description: error instanceof Error ? error.message : "Nao foi possivel carregar os feriados.",
          variant: "destructive",
        });
      } finally {
        if (mounted) setLoadingHolidays(false);
      }
    };
    loadCurrentYear();
    return () => { mounted = false; };
  }, [currentYear]);

  useEffect(() => {
    const fromYear = selectedRange?.from?.getFullYear();
    const toYear = selectedRange?.to?.getFullYear();
    if (!fromYear) return;

    const missingYears = new Set<number>();
    if (!holidaysByYear[fromYear]) missingYears.add(fromYear);
    if (toYear && !holidaysByYear[toYear]) missingYears.add(toYear);
    if (missingYears.size === 0) return;

    let mounted = true;
    const loadMissingYears = async () => {
      try {
        setLoadingHolidays(true);
        const entries = await Promise.all(
          Array.from(missingYears).map(async (year) => [year, await fetchHolidays({ year })] as const)
        );
        if (!mounted) return;
        setHolidaysByYear((prev) => {
          const next = { ...prev };
          entries.forEach(([year, holidays]) => { next[year] = holidays; });
          return next;
        });
      } catch (error) {
        toast({
          title: "Erro ao carregar feriados",
          description: error instanceof Error ? error.message : "Nao foi possivel carregar os feriados.",
          variant: "destructive",
        });
      } finally {
        if (mounted) setLoadingHolidays(false);
      }
    };
    loadMissingYears();
    return () => { mounted = false; };
  }, [selectedRange, holidaysByYear]);

  const allHolidays = useMemo(() => Object.values(holidaysByYear).flat(), [holidaysByYear]);
  const holidayDateSet = useMemo(() => new Set(allHolidays.map((item) => item.dateISO)), [allHolidays]);
  const holidayDates = useMemo(
    () =>
      Array.from(holidayDateSet).map((dateISO) => {
        const [year, month, day] = dateISO.split("-").map(Number);
        return new Date(year, month - 1, day);
      }),
    [holidayDateSet]
  );

  const selectedBusinessDays = useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to) return 0;
    return calculateBusinessDays(selectedRange.from, selectedRange.to, allHolidays);
  }, [selectedRange, allHolidays]);

  const editingVacation = useMemo(
    () => vacations.find((item) => item.id === editingVacationId) ?? null,
    [vacations, editingVacationId]
  );

  const vacationsForOverlapCheck = useMemo(() => {
    if (editingVacation) {
      return vacations.filter((item) => item.collaboratorUid === editingVacation.collaboratorUid);
    }
    return vacations.filter((item) => item.collaboratorUid === user?.uid);
  }, [vacations, editingVacation, user?.uid]);

  const hasOverlap = useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to) return false;
    return doesOverlap(selectedRange.from, selectedRange.to, vacationsForOverlapCheck, editingVacationId ?? undefined);
  }, [selectedRange, vacationsForOverlapCheck, editingVacationId]);

  const selectedHolidays = useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to) return [];
    const from = new Date(selectedRange.from.getFullYear(), selectedRange.from.getMonth(), selectedRange.from.getDate()).getTime();
    const to = new Date(selectedRange.to.getFullYear(), selectedRange.to.getMonth(), selectedRange.to.getDate()).getTime();
    return allHolidays
      .filter((holiday) => {
        const [year, month, day] = holiday.dateISO.split("-").map(Number);
        const holidayMs = new Date(year, month - 1, day).getTime();
        return holidayMs >= from && holidayMs <= to;
      })
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }, [selectedRange, allHolidays]);

  const availableCollaborators = useMemo(() => {
    const collaboratorMap = new Map<string, string>();
    vacations.forEach((vacation) => {
      const uid = vacation.collaboratorUid?.trim();
      if (!uid) return;
      if (!collaboratorMap.has(uid)) {
        collaboratorMap.set(uid, vacation.collaboratorName?.trim() || "Colaborador sem nome");
      }
    });
    return Array.from(collaboratorMap.entries())
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [vacations]);

  useEffect(() => {
    if (!canUseAdminFilter) {
      if (collaboratorFilter !== "all") setCollaboratorFilter("all");
      return;
    }
    if (collaboratorFilter === "all") return;
    const hasSelectedCollaborator = availableCollaborators.some((c) => c.uid === collaboratorFilter);
    if (!hasSelectedCollaborator) setCollaboratorFilter("all");
  }, [canUseAdminFilter, collaboratorFilter, availableCollaborators]);

  const filteredVacations = useMemo(() => {
    if (!canUseAdminFilter) return vacations;
    if (collaboratorFilter === "all") return vacations;
    return vacations.filter((vacation) => vacation.collaboratorUid === collaboratorFilter);
  }, [vacations, canUseAdminFilter, collaboratorFilter]);

  const getUserUsedDaysInCurrentYear = (collaboratorUid: string, ignoreVacationId?: string) =>
    vacations
      .filter((item) => {
        if (item.collaboratorUid !== collaboratorUid) return false;
        if (ignoreVacationId && item.id === ignoreVacationId) return false;
        const vacationYear = Number(item.startDate.split("-")[0]);
        return vacationYear === currentYear;
      })
      .reduce((acc, item) => acc + Math.max(0, Number(item.businessDays || 0)), 0);

  const targetCollaboratorUid = editingVacation?.collaboratorUid ?? user?.uid ?? "";
  const targetUsedDays = targetCollaboratorUid
    ? getUserUsedDaysInCurrentYear(targetCollaboratorUid, editingVacationId ?? undefined)
    : 0;
  const targetRemainingDays = Math.max(0, totalDays - targetUsedDays);
  const wouldExceedBalance = selectedBusinessDays > targetRemainingDays;
  const canSave = !!selectedRange?.from && !!selectedRange?.to && selectedBusinessDays > 0 && !hasOverlap && !wouldExceedBalance;

  const handleOpenCreateDialog = () => {
    setEditingVacationId(null);
    setSelectedRange(undefined);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (vacationId: string, startDate: string, endDate: string) => {
    if (!isSuperAdmin) {
      toast({ title: "Acesso restrito", description: "Somente administradores podem editar ferias.", variant: "destructive" });
      return;
    }
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    setEditingVacationId(vacationId);
    setSelectedRange({
      from: new Date(startYear, startMonth - 1, startDay),
      to: new Date(endYear, endMonth - 1, endDay),
    });
    setIsDialogOpen(true);
  };

  const handleSaveVacation = async () => {
    if (!selectedRange?.from || !selectedRange?.to) {
      toast({ title: "Selecione um periodo de ferias", variant: "destructive" });
      return;
    }
    if (!canSave) {
      toast({
        title: "Nao foi possivel registrar as ferias",
        description: "Verifique se o periodo nao tem sobreposicao e se o saldo e suficiente.",
        variant: "destructive",
      });
      return;
    }

    const toISO = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    try {
      setIsSaving(true);
      if (editingVacationId) {
        const editing = vacations.find((item) => item.id === editingVacationId);
        if (!editing) throw new Error("Registro de ferias nao encontrado.");
        await updateVacation({
          ...editing,
          startDate: toISO(selectedRange.from),
          endDate: toISO(selectedRange.to),
          businessDays: selectedBusinessDays,
        });
        toast({ title: "Ferias atualizadas com sucesso." });
      } else if (isRequestMode) {
        await createRequest({
          startDate: toISO(selectedRange.from),
          endDate: toISO(selectedRange.to),
          businessDays: selectedBusinessDays,
        });
        toast({ title: "Solicitação de férias enviada com sucesso.", description: "Aguarde a aprovação de um gestor." });
      } else {
        await addVacation({
          startDate: toISO(selectedRange.from),
          endDate: toISO(selectedRange.to),
          businessDays: selectedBusinessDays,
        });
        toast({ title: "Ferias registradas com sucesso." });
      }
      setSelectedRange(undefined);
      setEditingVacationId(null);
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao registrar ferias",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este periodo de ferias?")) return;
    try {
      await deleteVacationMutation.mutateAsync(id);
      toast({ title: "Periodo de ferias removido com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao excluir ferias",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      await approveRequest(requestId);
      toast({ title: "Solicitação aprovada com sucesso.", description: "As férias foram registradas." });
    } catch (error) {
      toast({
        title: "Erro ao aprovar solicitação",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleOpenRejectDialog = (requestId: string) => {
    setRejectingRequestId(requestId);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequestId) return;
    setProcessingRequestId(rejectingRequestId);
    try {
      await rejectRequest(rejectingRequestId, rejectReason);
      toast({ title: "Solicitação reprovada." });
      setRejectDialogOpen(false);
      setRejectingRequestId(null);
      setRejectReason("");
    } catch (error) {
      toast({
        title: "Erro ao reprovar solicitação",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const requesterVisibleQueue = useMemo(
    () =>
      requests
        .filter((request) => {
          if (request.status === "pending") return true;
          if (request.status === "rejected" && !request.requesterArchivedAt) return true;
          return false;
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime()
        ),
    [requests]
  );

  const isApprover = isSuperAdmin || canApproveVacationRequests;

  const approverPendingQueue = useMemo(
    () =>
      pendingRequests.filter((r) => {
        if (isSuperAdmin) return true;
        return r.responsibleUid === user?.uid;
      }),
    [pendingRequests, isSuperAdmin, user?.uid]
  );

  const queueRequests = useMemo(
    () => (isApprover ? approverPendingQueue : requesterVisibleQueue),
    [isApprover, approverPendingQueue, requesterVisibleQueue]
  );

  const historyRequests = useMemo(
    () => [...approvedRequests].sort(
      (a, b) => new Date(b.reviewedAt ?? b.updatedAt).getTime() - new Date(a.reviewedAt ?? a.updatedAt).getTime()
    ),
    [approvedRequests]
  );

  const canApproveRequest = (request: VacationRequest) => {
    if (isSuperAdmin) return true;
    if (!canApproveVacationRequests) return false;
    if (!request.responsibleUid) return false;
    return request.responsibleUid === user?.uid;
  };

  const renderRequestRow = (request: VacationRequest, showActions: boolean) => {
    const config = statusConfig[request.status] ?? statusConfig.pending;
    const isProcessing = processingRequestId === request.id;
    const userCanApprove = canApproveRequest(request);

    return (
      <TableRow key={request.id}>
        <TableCell>{request.requesterName}</TableCell>
        <TableCell>
          {formatIsoDate(request.startDate)} - {formatIsoDate(request.endDate)}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{request.businessDays} dias</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={config.variant}>{config.label}</Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {request.responsibleName || "Sem responsável"}
        </TableCell>
        <TableCell>{new Date(request.createdAt).toLocaleDateString("pt-BR")}</TableCell>
        {showActions && userCanApprove && request.status === "pending" && (
          <TableCell className="text-right space-x-1">
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              disabled={isProcessing}
              onClick={() => handleApproveRequest(request.id)}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-700 border-red-300 hover:bg-red-50"
              disabled={isProcessing}
              onClick={() => handleOpenRejectDialog(request.id)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reprovar
            </Button>
          </TableCell>
        )}
        {showActions && userCanApprove && request.status !== "pending" && (
          <TableCell className="text-right">
            {request.reviewedByName && (
              <span className="text-xs text-muted-foreground">
                {request.status === "approved" ? "Aprovado" : "Reprovado"} por {request.reviewedByName}
              </span>
            )}
          </TableCell>
        )}
        {showActions && !userCanApprove && (
          <TableCell className="text-right">
            {request.status === "rejected" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={async () => {
                  setProcessingRequestId(request.id);
                  try {
                    await archiveRejectedRequest(request.id);
                    toast({ title: "Solicitação arquivada." });
                  } catch (error) {
                    toast({
                      title: "Erro ao arquivar solicitação",
                      description:
                        error instanceof Error ? error.message : "Falha inesperada.",
                      variant: "destructive",
                    });
                  } finally {
                    setProcessingRequestId(null);
                  }
                }}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4 mr-1" />
                )}
                Arquivar
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Pendente de aprovação
              </span>
            )}
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              Dias Úteis Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Dias Utilizados Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{usedDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Dias Úteis Restantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{remainingDays}</p>
          </CardContent>
        </Card>
      </div>

      {queueRequests.length > 0 && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              {isApprover ? "Solicitações Pendentes" : "Solicitações"}
              <Badge variant="outline" className="ml-2">{queueRequests.length}</Badge>
            </CardTitle>
            <CardDescription>
              {isApprover
                ? "Solicitações aguardando sua aprovação ou reprovação."
                : "Suas solicitações pendentes de aprovação e reprovadas ainda não arquivadas."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Dias Úteis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Solicitado Em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueRequests.map((req) => renderRequestRow(req, true))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-l-4 border-l-emerald-600">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Férias</CardTitle>
            <CardDescription>
              {isRequestMode
                ? "Solicite seus períodos de férias. Feriados nacionais são desconsiderados automaticamente. A solicitação será analisada por um aprovador."
                : "Registre os seus periodos de ferias em dias uteis. Feriados nacionais sao desconsiderados automaticamente. Alteracoes e exclusoes devem ser solicitadas a um administrador."}
            </CardDescription>
          </div>
          <div className="flex w-full md:w-auto flex-wrap items-center gap-2 justify-end">
            {canUseAdminFilter && (
              <Select value={collaboratorFilter} onValueChange={setCollaboratorFilter}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Filtrar colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {availableCollaborators.map((collaborator) => (
                    <SelectItem key={collaborator.uid} value={collaborator.uid}>
                      {collaborator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleOpenCreateDialog} className="bg-admin-primary hover:bg-admin-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" />
              {isRequestMode ? "Solicitar Férias" : "Adicionar Férias"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Dias Úteis</TableHead>
                  <TableHead>Registrado Em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVacations.map((vacation) => (
                  <TableRow key={vacation.id}>
                    <TableCell>{vacation.collaboratorName}</TableCell>
                    <TableCell>
                      {formatIsoDate(vacation.startDate)} - {formatIsoDate(vacation.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{vacation.businessDays} dias</Badge>
                    </TableCell>
                    <TableCell>{new Date(vacation.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const canEditOrDelete = isSuperAdmin;
                        return (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditDialog(vacation.id, vacation.startDate, vacation.endDate)}
                              disabled={!canEditOrDelete}
                              title={canEditOrDelete ? "Editar ferias" : "Somente administradores podem editar"}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteVacation(vacation.id)}
                              disabled={!canEditOrDelete || (deleteVacationMutation.isPending && deleteVacationMutation.variables === vacation.id)}
                              title={canEditOrDelete ? "Excluir ferias" : "Somente administradores podem excluir"}
                            >
                              {deleteVacationMutation.isPending && deleteVacationMutation.variables === vacation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredVacations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum periodo de ferias registrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {historyRequests.length > 0 && (
        <Card className="border-l-4 border-l-slate-400">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Solicitações
              </CardTitle>
              <CardDescription>
                Registro de solicitações aprovadas.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? "Ocultar" : "Mostrar"}
            </Button>
          </CardHeader>
          {showHistory && (
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Dias Úteis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decisão Por</TableHead>
                      <TableHead>Data Decisão</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRequests.map((req) => {
                      const config = statusConfig[req.status] ?? statusConfig.pending;
                      return (
                        <TableRow key={req.id}>
                          <TableCell>{req.requesterName}</TableCell>
                          <TableCell>
                            {formatIsoDate(req.startDate)} - {formatIsoDate(req.endDate)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{req.businessDays} dias</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.variant}>{config.label}</Badge>
                          </TableCell>
                          <TableCell>{req.reviewedByName || "-"}</TableCell>
                          <TableCell>
                            {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString("pt-BR") : "-"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={req.reviewReason || ""}>
                            {req.reviewReason || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRange(undefined);
            setEditingVacationId(null);
          }
          setIsDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingVacationId
                ? "Editar Férias"
                : isRequestMode
                  ? "Solicitar Férias"
                  : "Adicionar Férias"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <p className="text-sm text-muted-foreground mt-1">{currentUserCollab?.name ?? "Usuario atual"}</p>
            </div>

            <div className="space-y-2">
              <Label>Selecione o periodo no calendario</Label>
              <div className="rounded-md border p-2">
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={setSelectedRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  modifiers={{ holiday: holidayDates }}
                  modifiersClassNames={{ holiday: "bg-amber-100 text-amber-900 font-semibold rounded-md" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Feriados sao destacados no calendario.</p>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm">
                Dias uteis do periodo selecionado: <strong>{selectedBusinessDays}</strong>
              </p>
              <p className="text-sm">
                Saldo apos registro: <strong>{Math.max(0, targetRemainingDays - selectedBusinessDays)}</strong>
              </p>
              {loadingHolidays && (
                <div className="flex items-center justify-center py-1">
                  <Loader2 className="h-4 w-4 animate-spin text-admin-primary" />
                </div>
              )}
              {hasOverlap && <p className="text-sm text-destructive">O periodo selecionado se sobrepoe a um registro existente.</p>}
              {wouldExceedBalance && <p className="text-sm text-destructive">O periodo selecionado excede seu saldo de ferias.</p>}
              {selectedRange?.from && selectedRange?.to && selectedBusinessDays === 0 && (
                <p className="text-sm text-destructive">O periodo selecionado nao possui dias uteis.</p>
              )}
              {selectedRange?.from && selectedRange?.to && (
                <div className="pt-2">
                  <p className="text-sm font-medium">Feriados no periodo selecionado:</p>
                  {selectedHolidays.length > 0 ? (
                    <ul className="mt-1 text-sm text-muted-foreground space-y-1">
                      {selectedHolidays.map((holiday) => (
                        <li key={`${holiday.dateISO}-${holiday.name}`}>
                          {new Date(`${holiday.dateISO}T00:00:00`).toLocaleDateString("pt-BR")} - {holiday.name} ({holiday.type})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Nenhum feriado nacional no periodo selecionado.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveVacation} disabled={!canSave || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVacationId ? "Salvar" : isRequestMode ? "Enviar Solicitação" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reprovar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo da reprovação (opcional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Descreva o motivo..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={processingRequestId !== null}
            >
              {processingRequestId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

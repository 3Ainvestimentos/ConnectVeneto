"use client";

import React, { useMemo, useState } from "react";
import { useTripsBirthdays, type BirthdayImportRow, type LeaderTripType } from "@/contexts/TripsBirthdaysContext";
import { useCollaborators } from "@/contexts/CollaboratorsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Edit, Loader2, PlusCircle, Trash2, Upload, Gift, Plane, ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import { TRIP_DESTINATIONS } from "@/lib/trips";

const ENABLE_BIRTHDAYS_UI = false;

const destinations: readonly string[] = TRIP_DESTINATIONS;

const tripSchema = z
  .object({
    id: z.string().optional(),
    leaderName: z.string().min(3, "Nome do líder é obrigatório"),
    destinationBranch: z.string().min(1, "Destino é obrigatório"),
    startDate: z.string().min(1, "Data de início é obrigatória"),
    endDate: z.string().min(1, "Data de fim é obrigatória"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "A data de fim deve ser maior ou igual à data de início",
    path: ["endDate"],
  });

type TripFormValues = z.infer<typeof tripSchema>;

interface ImportPreview {
  rows: BirthdayImportRow[];
  invalidCount: number;
  duplicateCount: number;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toISODateFromExcelSerial(serial: number): string {
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + serial * 86400000);
  return date.toISOString().split("T")[0];
}

function parseDateToISO(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return toISODateFromExcelSerial(value);
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").trim();
    if (!normalized) return null;

    const ddmmyyyy = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy;
      return `${y}-${m}-${d}`;
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  return null;
}

function toDayMonth(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function formatDDMM(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export default function ManageTripsBirthdays() {
  const { trips, birthdays, addTrip, updateTrip, deleteTripMutation, importBirthdays, deleteBirthdayMutation, clearBirthdays } =
    useTripsBirthdays();
  const { collaborators } = useCollaborators();
  const { user, isSuperAdmin } = useAuth();

  const [isTripDialogOpen, setIsTripDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<LeaderTripType | null>(null);
  const [leaderSearch, setLeaderSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [isImporting, setIsImporting] = useState(false);
  type TripSortKey = "leaderName" | "area" | "destinationBranch" | "startDate" | "responsavelNome" | "status";
  const [sortKey, setSortKey] = useState<TripSortKey>("startDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
  });

  const leaderFieldValue = watch("leaderName");
  const uniqueLeaders = useMemo(
    () =>
      [...new Set(collaborators.map((c) => normalizeName(c.name)).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [collaborators]
  );

  const filteredSuggestions = useMemo(() => {
    const search = leaderSearch.trim().toLowerCase();
    if (!search) return uniqueLeaders;
    return uniqueLeaders.filter((name) => name.toLowerCase().includes(search));
  }, [leaderSearch, uniqueLeaders]);

  const leaderAreaMap = useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((c) => {
      map.set(normalizeName(c.name).toLowerCase(), c.area ?? "");
    });
    return map;
  }, [collaborators]);

  const displayedTrips = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const withStatus = trips.map((trip) => {
      const [y, m, d] = trip.endDate.split("-").map(Number);
      const end = new Date(y, m - 1, d);
      const area = leaderAreaMap.get(normalizeName(trip.leaderName).toLowerCase()) ?? "";
      return { ...trip, isActive: end >= now, area };
    });

    return [...withStatus].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "leaderName") {
        comparison = a.leaderName.localeCompare(b.leaderName, "pt-BR");
      } else if (sortKey === "area") {
        comparison = (a.area || "").localeCompare(b.area || "", "pt-BR");
      } else if (sortKey === "destinationBranch") {
        comparison = a.destinationBranch.localeCompare(b.destinationBranch, "pt-BR");
      } else if (sortKey === "startDate") {
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      } else if (sortKey === "responsavelNome") {
        const nameA = a.responsavelNome || "Sem responsável";
        const nameB = b.responsavelNome || "Sem responsável";
        comparison = nameA.localeCompare(nameB, "pt-BR");
      } else if (sortKey === "status") {
        comparison = (a.isActive === b.isActive) ? 0 : a.isActive ? 1 : -1;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [trips, sortKey, sortDirection, leaderAreaMap]);

  const displayedBirthdays = useMemo(() => {
    const base = [...birthdays].sort((a, b) => a.dayMonth.localeCompare(b.dayMonth, "pt-BR"));
    if (selectedMonth === "all") return base;
    const month = Number(selectedMonth);
    return base.filter((item) => {
      const [, m] = item.dayMonth.split("/").map(Number);
      return m === month;
    });
  }, [birthdays, selectedMonth]);

  const handleSort = (key: TripSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const SortableHeader = ({ tkey, label }: { tkey: TripSortKey; label: string }) => (
    <TableHead onClick={() => handleSort(tkey)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-1">
        {label}
        {sortKey === tkey && (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
      </div>
    </TableHead>
  );

  const handleTripDialogOpen = (trip: LeaderTripType | null) => {
    setEditingTrip(trip);
    if (trip) {
      reset({
        id: trip.id,
        leaderName: trip.leaderName,
        destinationBranch: trip.destinationBranch,
        startDate: trip.startDate.split("T")[0],
        endDate: trip.endDate.split("T")[0],
      });
      setLeaderSearch(trip.leaderName);
    } else {
      reset({
        id: undefined,
        leaderName: "",
        destinationBranch: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
      });
      setLeaderSearch("");
    }
    setIsTripDialogOpen(true);
  };

  const onSubmitTrip = async (data: TripFormValues) => {
    try {
      const payload = {
        leaderName: normalizeName(data.leaderName),
        destinationBranch: data.destinationBranch,
        startDate: data.startDate,
        endDate: data.endDate,
      };

      if (editingTrip) {
        await updateTrip({
          ...editingTrip,
          ...payload,
        });
        toast({ title: "Viagem atualizada com sucesso." });
      } else {
        await addTrip(payload);
        toast({ title: "Viagem cadastrada com sucesso." });
      }
      setIsTripDialogOpen(false);
      setEditingTrip(null);
    } catch (error) {
      toast({
        title: "Erro ao salvar viagem",
        description: error instanceof Error ? error.message : "Não foi possível salvar a viagem.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTrip = async (id: string, leaderName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a viagem de "${leaderName}"?`)) return;
    try {
      await deleteTripMutation.mutateAsync(id);
      toast({ title: "Viagem excluída com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao excluir viagem",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    }
  };

  const parseSpreadsheet = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const dedupe = new Set<string>();
    const validRows: BirthdayImportRow[] = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    rows.forEach((row) => {
      const rawName = String(row["Nome"] || "").trim();
      const rawUnit = String(row["Unidade"] || "").trim();
      const rawDate = row["Data de Aniversário"] || row["Data de Aniversario"];
      const parsedISO = parseDateToISO(rawDate);

      if (!rawName || !rawUnit || !parsedISO) {
        invalidCount += 1;
        return;
      }

      const normalizedName = normalizeName(rawName);
      const dayMonth = toDayMonth(parsedISO);
      const key = `${normalizedName.toLowerCase()}|${dayMonth}`;

      if (dedupe.has(key)) {
        duplicateCount += 1;
        return;
      }

      dedupe.add(key);
      validRows.push({
        fullName: normalizedName,
        unitCode: rawUnit,
        birthDateISO: parsedISO,
        dayMonth,
      });
    });

    return { rows: validRows, invalidCount, duplicateCount };
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    if (!isXlsx) {
      toast({ title: "Formato inválido", description: "Envie um arquivo .xlsx", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 5MB por planilha.", variant: "destructive" });
      return;
    }

    try {
      const result = await parseSpreadsheet(file);
      setPreview(result);
      toast({
        title: "Planilha lida com sucesso",
        description: `${result.rows.length} linhas válidas, ${result.invalidCount} inválidas, ${result.duplicateCount} duplicadas.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao ler planilha",
        description: error instanceof Error ? error.message : "Não foi possível processar a planilha.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (!preview || preview.rows.length === 0) {
      toast({ title: "Nenhum dado para importar", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importBirthdays(preview.rows);
      toast({
        title: "Importação concluída",
        description: `${result.created} criados, ${result.updated} atualizados e ${result.skipped} ignorados.`,
      });
      setPreview(null);
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Não foi possível concluir a importação.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteBirthday = async (id: string, fullName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${fullName}" da lista de aniversariantes?`)) return;
    try {
      await deleteBirthdayMutation.mutateAsync(id);
      toast({ title: "Aniversariante removido com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao remover aniversariante",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    }
  };

  const handleClearBirthdays = async () => {
    if (!window.confirm("Tem certeza que deseja limpar todos os aniversariantes importados?")) return;
    try {
      await clearBirthdays();
      toast({ title: "Lista de aniversariantes limpa com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao limpar aniversariantes",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {ENABLE_BIRTHDAYS_UI && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-500" />
              Aniversariantes (Upload de Planilha)
            </CardTitle>
            <CardDescription>Suba uma planilha atualizada (.xlsx) para mesclar aniversariantes por Nome + Data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="w-full">
                <Label htmlFor="birthdays-file">Planilha de aniversariantes</Label>
                <Input id="birthdays-file" type="file" accept=".xlsx" onChange={handleFileChange} />
              </div>
              <Button onClick={handleImport} disabled={!preview || preview.rows.length === 0 || isImporting} className="sm:w-auto">
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Importar atualização
              </Button>
            </div>

            {preview && (
              <div className="rounded-md border p-3 text-sm space-y-2">
                <p>
                  Prévia: <strong>{preview.rows.length}</strong> válidas, <strong>{preview.invalidCount}</strong> inválidas,
                  <strong> {preview.duplicateCount}</strong> duplicadas.
                </p>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row, index) => (
                        <TableRow key={`${row.fullName}-${row.dayMonth}-${index}`}>
                          <TableCell>{row.fullName}</TableCell>
                          <TableCell>{row.unitCode}</TableCell>
                          <TableCell>{row.dayMonth}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="month-filter">Filtrar mês:</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger id="month-filter" className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const monthValue = String(idx + 1);
                      return (
                        <SelectItem key={monthValue} value={monthValue}>
                          {String(idx + 1).padStart(2, "0")}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleClearBirthdays} disabled={birthdays.length === 0}>
                Limpar aniversariantes
              </Button>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedBirthdays.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.fullName}</TableCell>
                      <TableCell>{item.unitCode}</TableCell>
                      <TableCell>{item.dayMonth}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBirthday(item.id, item.fullName)}
                          disabled={deleteBirthdayMutation.isPending && deleteBirthdayMutation.variables === item.id}
                        >
                          {deleteBirthdayMutation.isPending && deleteBirthdayMutation.variables === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayedBirthdays.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhum aniversariante encontrado para o filtro selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-l-4 border-l-sky-600">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-sky-600" />
              Viagens dos Líderes
            </CardTitle>
            <CardDescription>Cadastre, edite e remova viagens programadas dos líderes.</CardDescription>
          </div>
          <Button onClick={() => handleTripDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Viagem
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader tkey="leaderName" label="Líder" />
                  <SortableHeader tkey="area" label="Área" />
                  <SortableHeader tkey="destinationBranch" label="Destino" />
                  <SortableHeader tkey="startDate" label="Período" />
                  <SortableHeader tkey="responsavelNome" label="Responsável" />
                  <SortableHeader tkey="status" label="Status" />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTrips.map((trip) => {
                  const isOwner = !!trip.responsavelUid && trip.responsavelUid === user?.uid;
                  const canEdit = isOwner;
                  const canDelete = isOwner || isSuperAdmin;

                  return (
                    <TableRow key={trip.id} className={!trip.isActive ? "opacity-60" : undefined}>
                      <TableCell>{trip.leaderName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{trip.area || "—"}</TableCell>
                      <TableCell>{trip.destinationBranch}</TableCell>
                      <TableCell>
                        {formatDDMM(trip.startDate)} - {formatDDMM(trip.endDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {trip.responsavelNome || "Sem responsável"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={trip.isActive ? "default" : "destructive"}
                          className={trip.isActive ? "bg-admin-primary text-white hover:bg-admin-primary/90" : undefined}
                        >
                          {trip.isActive ? "Prevista" : "Executada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTripDialogOpen(trip)}
                          disabled={!canEdit}
                          title={canEdit ? "Editar viagem" : "Somente o responsável pode editar"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTrip(trip.id, trip.leaderName)}
                          disabled={!canDelete || (deleteTripMutation.isPending && deleteTripMutation.variables === trip.id)}
                          title={canDelete ? "Excluir viagem" : "Somente o responsável pode excluir"}
                        >
                          {deleteTripMutation.isPending && deleteTripMutation.variables === trip.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {displayedTrips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhuma viagem cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isTripDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingTrip(null);
          setIsTripDialogOpen(isOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTrip ? "Editar Viagem" : "Adicionar Viagem"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitTrip)} className="space-y-4">
            <div className="relative">
              <Label htmlFor="leaderName">Nome do Líder</Label>
              <Input
                id="leaderName"
                {...register("leaderName")}
                value={leaderFieldValue || ""}
                onChange={(e) => {
                  setValue("leaderName", e.target.value, { shouldValidate: true });
                  setLeaderSearch(e.target.value);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                autoComplete="off"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md max-h-48 overflow-auto">
                  {filteredSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setValue("leaderName", name, { shouldValidate: true });
                        setLeaderSearch(name);
                        setShowSuggestions(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {errors.leaderName && <p className="text-sm text-destructive mt-1">{errors.leaderName.message}</p>}
            </div>

            <div>
              <Label htmlFor="destinationBranch">Filial de Destino</Label>
              <Select
                value={watch("destinationBranch")}
                onValueChange={(value) => setValue("destinationBranch", value, { shouldValidate: true })}
              >
                <SelectTrigger id="destinationBranch">
                  <SelectValue placeholder="Selecione uma filial" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((destination) => (
                    <SelectItem key={destination} value={destination}>
                      {destination}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.destinationBranch && (
                <p className="text-sm text-destructive mt-1">{errors.destinationBranch.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="startDate">Data de Início</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>}
            </div>

            <div>
              <Label htmlFor="endDate">Data de Fim</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
              {errors.endDate && <p className="text-sm text-destructive mt-1">{errors.endDate.message}</p>}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

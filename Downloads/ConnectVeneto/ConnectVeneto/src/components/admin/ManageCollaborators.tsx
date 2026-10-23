
"use client";
import React, { useState, useRef, useMemo } from 'react';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { DEFAULT_PERMISSIONS } from '@/lib/access/catalog';
import type { Collaborator } from '@/contexts/CollaboratorsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Upload, FileDown, AlertTriangle, Search, ChevronUp, ChevronDown, Filter, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import Papa from 'papaparse';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { CollaboratorAuditLogModal } from './CollaboratorAuditLogModal';
import { ProfileImportDialog } from './ProfileImportDialog';
import { useOrgUnits } from '@/hooks/useOrgUnits';
import { unitPathLabel } from '@/lib/hub/org-units';

/**
 * Limites de hardening para uploads administrativos.
 * Coerente com `ManageTripsBirthdays` (5 MB) e adiciona teto de linhas
 * para mitigar DoS local da dependência `xlsx` (advisories ReDoS/Prototype Pollution).
 */
export const COLLABORATORS_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const COLLABORATORS_IMPORT_MAX_ROWS = 5000;

export class CollaboratorsImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollaboratorsImportError';
  }
}

export function validateImportFileSize(file: File): void {
  if (file.size > COLLABORATORS_IMPORT_MAX_BYTES) {
    throw new CollaboratorsImportError(
      `Arquivo muito grande. O limite é ${Math.round(
        COLLABORATORS_IMPORT_MAX_BYTES / (1024 * 1024)
      )} MB por planilha.`
    );
  }
}

function normCsvHeader(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function csvRowToNormMap(row: CsvRow): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, val] of Object.entries(row)) {
    const nk = normCsvHeader(k);
    if (!nk) continue;
    m.set(nk, String(val ?? '').trim());
  }
  return m;
}

/** Lê célula por possíveis cabeçalhos (PT/EN). */
function pickCsvCell(m: Map<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    const nk = normCsvHeader(a);
    const v = m.get(nk);
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

const defaultPermissions: Collaborator["permissions"] = DEFAULT_PERMISSIONS;

/**
 * Linha da planilha → cadastro novo. Eixo, área, segmento, líder, equipe e liderança saíram do
 * cadastro (área, equipe e líder vêm da estrutura, ADR 0004): colunas com esses nomes são ignoradas.
 */
function mapCsvRowToCollaboratorDraft(row: CsvRow): Omit<Collaborator, 'id'> | null {
  const m = csvRowToNormMap(row);

  const idVeneto = pickCsvCell(m, 'id', 'idVeneto', 'id veneto').trim();
  const name = pickCsvCell(m, 'nome usual', 'name', 'nome');
  const email = pickCsvCell(m, 'e-mail', 'email', 'e mail').toLowerCase();
  const position = pickCsvCell(m, 'cargo', 'position');
  const city = pickCsvCell(m, 'cidade', 'city');
  const photoURL = pickCsvCell(m, 'photourl', 'photo url', 'url da foto') || '';

  if (!idVeneto || !name || !email || !position || !city) return null;

  return {
    idVeneto,
    name,
    email,
    photoURL,
    position,
    city,
    permissions: defaultPermissions,
  };
}

function csvHeadersLookValid(fieldNames: string[] | undefined): boolean {
  if (!fieldNames?.length) return false;
  const s = new Set(fieldNames.map(normCsvHeader).filter(Boolean));

  const portuguese =
    (s.has('id') || s.has('idveneto')) &&
    (s.has('nome usual') || s.has('name') || s.has('nome')) &&
    (s.has('e-mail') || s.has('email')) &&
    (s.has('cargo') || s.has('position')) &&
    s.has('cidade');

  const english =
    s.has('idveneto') &&
    s.has('name') &&
    s.has('email') &&
    s.has('position') &&
    s.has('city');

  return portuguese || english;
}

const collaboratorSchema = z.object({
    id: z.string().optional(),
    idVeneto: z.string().min(1, "ID Veneto é obrigatório"),
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    photoURL: z.string().url("URL da imagem inválida").optional().or(z.literal('')),
    position: z.string().min(1, "Cargo é obrigatório"),
    city: z.string().min(1, "Cidade é obrigatória"),
    // Perfil (Hub): dados oficiais mantidos pelo RH. Área, equipe e líder vêm da estrutura.
    leaderIdVeneto: z.string().max(60).optional().or(z.literal('')),
    unitId: z.string().max(80).optional().or(z.literal('')),
    managerOverrideIdVeneto: z.string().max(60).optional().or(z.literal('')),
    hubHidden: z.boolean().optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal('')),
    admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal('')),
    /** Uma linha por cargo: "Cargo | período" (ex.: "Analista | 2022–2024"). */
    careerHistoryText: z.string().max(4000).optional().or(z.literal('')),
});

type CollaboratorFormValues = z.infer<typeof collaboratorSchema>;

/** "Cargo | período" por linha <-> lista do Perfil. */
const historyToText = (h?: Collaborator['careerHistory']) => (h ?? []).map((s) => (s.period ? `${s.position} | ${s.period}` : s.position)).join('\n');
const textToHistory = (t?: string) =>
    (t ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [position, ...rest] = line.split('|');
            return { position: position.trim(), period: rest.join('|').trim() };
        })
        .filter((s) => s.position);

type CsvRow = { [key: string]: string };

type SortKey = keyof Collaborator | '';
type SortDirection = 'asc' | 'desc';

export function parseCsvFile(file: File): Promise<{ rows: CsvRow[]; headers: string[] | undefined }> {
  validateImportFileSize(file);
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      // Alguns conversores online adicionam "sep=;" na primeira linha.
      beforeFirstChunk: (chunk) => chunk.replace(/^\uFEFF?sep=.+\r?\n/i, ''),
      complete: (results) => {
        if (results.data.length > COLLABORATORS_IMPORT_MAX_ROWS) {
          reject(
            new CollaboratorsImportError(
              `O arquivo possui ${results.data.length} linhas. O limite é ${COLLABORATORS_IMPORT_MAX_ROWS} linhas por importação.`
            )
          );
          return;
        }
        resolve({ rows: results.data, headers: results.meta.fields });
      },
      error: (error) => reject(error),
    });
  });
}

export async function parseXlsxFile(file: File): Promise<{ rows: CsvRow[]; headers: string[] | undefined }> {
  validateImportFileSize(file);

  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new CollaboratorsImportError(
      'Planilha inválida: nenhuma aba encontrada. Salve novamente no formato XLSX padrão.'
    );
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new CollaboratorsImportError(
      'Planilha inválida: primeira aba vazia ou corrompida.'
    );
  }
  const rows = XLSX.utils.sheet_to_json<CsvRow>(sheet, { defval: '' });
  if (rows.length > COLLABORATORS_IMPORT_MAX_ROWS) {
    throw new CollaboratorsImportError(
      `A planilha possui ${rows.length} linhas. O limite é ${COLLABORATORS_IMPORT_MAX_ROWS} linhas por importação.`
    );
  }
  const headers = rows.length > 0 ? Object.keys(rows[0]) : undefined;
  return { rows, headers };
}

export function ManageCollaborators() {
    const { collaborators, addCollaborator, updateCollaborator, deleteCollaboratorMutation, addMultipleCollaborators } = useCollaborators();
    const { settings } = useSystemSettings();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isProfileImportOpen, setIsProfileImportOpen] = useState(false);
    const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [filters, setFilters] = useState<{ position: string[], city: string[] }>({ position: [], city: [] });

    const { units: orgUnits, byId: orgUnitsById } = useOrgUnits();
    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting: isFormSubmitting } } = useForm<CollaboratorFormValues>({
        resolver: zodResolver(collaboratorSchema),
    });

    const { uniquePositions, uniqueCities } = useMemo(() => {
        const positions = new Set<string>();
        const cities = new Set<string>();
        collaborators.forEach(c => {
            if(c.position) positions.add(c.position);
            if(c.city) cities.add(c.city);
        });
        return {
            uniquePositions: [...positions].sort(),
            uniqueCities: [...cities].sort()
        };
    }, [collaborators]);

    const filteredAndSortedCollaborators = useMemo(() => {
        let items = [...collaborators];

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            items = items.filter(c => {
                const nameMatch = c.name?.toLowerCase().includes(lowercasedTerm) ?? false;
                const emailMatch = c.email?.toLowerCase().includes(lowercasedTerm) ?? false;
                const idMatch = c.idVeneto?.toLowerCase().includes(lowercasedTerm) || false;
                return nameMatch || emailMatch || idMatch;
            });
        }
        
        Object.entries(filters).forEach(([key, values]) => {
            if (values.length > 0) {
                items = items.filter(c => {
                    const v = c[key as keyof Collaborator];
                    return typeof v === 'string' && values.includes(v);
                });
            }
        });


        if (sortKey) {
            items.sort((a, b) => {
                const valA = a[sortKey as keyof Collaborator];
                const valB = b[sortKey as keyof Collaborator];
                let comparison = 0;
                if (valA && valB) {
                    comparison = String(valA).localeCompare(String(valB));
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        return items;
    }, [collaborators, searchTerm, sortKey, sortDirection, filters]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    const handleFilterChange = (filterKey: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const currentValues = prev[filterKey];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterKey]: newValues };
        });
    };

    const handleFormDialogOpen = (collaborator: Collaborator | null) => {
        setEditingCollaborator(collaborator);
        if (collaborator) {
            reset({
                ...collaborator,
                leaderIdVeneto: collaborator.leaderIdVeneto ?? '',
                unitId: collaborator.unitId ?? '',
                managerOverrideIdVeneto: collaborator.managerOverrideIdVeneto ?? '',
                hubHidden: collaborator.hubHidden ?? false,
                birthDate: collaborator.birthDate ?? '',
                admissionDate: collaborator.admissionDate ?? '',
                careerHistoryText: historyToText(collaborator.careerHistory),
            });
        } else {
            reset({
                id: undefined,
                idVeneto: '',
                name: '',
                email: '',
                photoURL: '',
                position: '',
                city: '',
                leaderIdVeneto: '',
                unitId: '',
                managerOverrideIdVeneto: '',
                hubHidden: false,
                birthDate: '',
                admissionDate: '',
                careerHistoryText: '',
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este colaborador?")) return;

        try {
            await deleteCollaboratorMutation.mutateAsync(id);
            toast({ title: "Sucesso!", description: "Colaborador excluído." });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
            toast({ title: "Falha na Exclusão", description: errorMessage, variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: CollaboratorFormValues) => {
        const { careerHistoryText, ...rest } = data;
        // Sem unidade, o nome legado (`leader`) acompanha o gestor escolhido; com unidade, o servidor
        // deriva área, equipe e líder da estrutura (org-derived).
        const legacyManagerId = rest.unitId ? '' : rest.leaderIdVeneto?.trim();
        const manager = legacyManagerId ? collaborators.find((c) => c.idVeneto === legacyManagerId) : undefined;
        const processedData = {
          ...rest,
          idVeneto: data.idVeneto,
          leaderIdVeneto: rest.leaderIdVeneto?.trim() ?? '',
          unitId: rest.unitId ?? '',
          managerOverrideIdVeneto: rest.unitId ? (rest.managerOverrideIdVeneto?.trim() ?? '') : '',
          hubHidden: rest.hubHidden ?? false,
          ...(manager ? { leader: manager.name } : {}),
          birthDate: rest.birthDate ?? '',
          admissionDate: rest.admissionDate ?? '',
          careerHistory: textToHistory(careerHistoryText),
          permissions: editingCollaborator?.permissions || defaultPermissions,
        };
        
        try {
            if (editingCollaborator) {
                await updateCollaborator(editingCollaborator, processedData);
                toast({ title: "Colaborador atualizado com sucesso." });
            } else {
                const { id: _id, ...dataWithoutId } = processedData;
                await addCollaborator(dataWithoutId as Omit<Collaborator, 'id'>);
                toast({ title: "Colaborador adicionado com sucesso." });
            }
            setIsFormOpen(false);
            setEditingCollaborator(null);
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                description: error instanceof Error ? error.message : "Não foi possível salvar o colaborador.",
                variant: "destructive"
            });
        }
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        (async () => {
          try {
            const isExcel = /\.xlsx?$/i.test(file.name);
            const { rows, headers: fileHeaders } = isExcel
              ? await parseXlsxFile(file)
              : await parseCsvFile(file);

            if (!csvHeadersLookValid(fileHeaders)) {
              toast({
                title: "Erro no arquivo",
                description:
                  "Cabeçalhos inválidos. Use: ID, NOME USUAL, E-MAIL, CARGO, CIDADE (ou formato legado em inglês).",
                variant: "destructive",
              });
              return;
            }

            const mapped = rows.map((row) => mapCsvRowToCollaboratorDraft(row));
            const newCollaborators = mapped.filter((c): c is Omit<Collaborator, 'id'> => c !== null);
            const invalidCount = mapped.length - newCollaborators.length;

            if (newCollaborators.length === 0) {
              toast({
                title: "Nenhum dado válido encontrado",
                description:
                  "Arquivo lido, mas nenhuma linha pôde ser convertida. Verifique se as colunas obrigatórias estão preenchidas (ID, NOME USUAL, E-MAIL, CARGO, CIDADE).",
                variant: "destructive",
              });
              return;
            }

            try {
              await addMultipleCollaborators(newCollaborators);
              toast({
                title: "Importação concluída",
                description:
                  invalidCount > 0
                    ? `${newCollaborators.length} colaboradores importados (${invalidCount} linhas ignoradas por dados incompletos).`
                    : `${newCollaborators.length} colaboradores importados com sucesso.`,
              });
              setIsImportOpen(false);
            } catch (e) {
              const raw = e instanceof Error ? e.message : String(e);
              const isPermission =
                /permission-denied|PERMISSION_DENIED/i.test(raw) ||
                /Missing or insufficient permissions/i.test(raw);
              toast({
                title: "Erro na importação",
                description: isPermission
                  ? "Sem permissão para importar em lote. Verifique se seu e-mail está em `superAdminEmails` ou em `collaboratorAdminEmails` e publique as regras do Firestore."
                  : raw || "Ocorreu um erro desconhecido.",
                variant: "destructive",
              });
            }
          } catch (error) {
            const isImportLimit = error instanceof CollaboratorsImportError;
            toast({
              title: isImportLimit ? 'Importação bloqueada' : 'Erro ao processar arquivo',
              description:
                error instanceof Error
                  ? error.message
                  : 'Não foi possível ler o arquivo enviado.',
              variant: 'destructive',
            });
          } finally {
            setIsImporting(false);
          }
        })();

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleExportCSV = () => {
        if (filteredAndSortedCollaborators.length === 0) {
            toast({ title: "Nenhum dado para exportar", variant: 'destructive' });
            return;
        }

        const dataToExport = filteredAndSortedCollaborators.map(c => ({
            idVeneto: c.idVeneto,
            name: c.name,
            email: c.email,
            photoURL: c.photoURL || '',
            position: c.position,
            city: c.city,
            unit: c.unitId ? unitPathLabel(orgUnitsById, c.unitId) : '',
            leaderIdVeneto: c.leaderIdVeneto || '',
            birthDate: c.birthDate || '',
            admissionDate: c.admissionDate || '',
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `colaboradores_intranet_veneto_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const SortableHeader = ({ tkey, label }: { tkey: SortKey, label: string }) => (
        <TableHead>
             <button onClick={() => handleSort(tkey)} className="flex items-center gap-1 hover:text-foreground">
                {label}
                {sortKey === tkey && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
            </button>
        </TableHead>
    );
    
    const FilterableHeader = ({ fkey, label, uniqueValues }: { fkey: keyof typeof filters, label: string, uniqueValues: string[] }) => (
        <TableHead>
            <div className="flex items-center gap-2">
                <span className="flex-grow">{label}</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-60 overflow-y-auto">
                        <DropdownMenuLabel>Filtrar por {label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea>
                        {uniqueValues.map(value => (
                            <DropdownMenuCheckboxItem
                                key={value}
                                checked={filters[fkey].includes(value)}
                                onCheckedChange={() => handleFilterChange(fkey, value)}
                            >
                                {value}
                            </DropdownMenuCheckboxItem>
                        ))}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </TableHead>
    );

    return (
        <>
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                     <div className="flex-grow">
                        <CardTitle>Gerenciar Colaboradores</CardTitle>
                        <CardDescription>
                            Exibindo {filteredAndSortedCollaborators.length} de {collaborators.length} | Versão da Tabela: <Badge variant="secondary" className="font-mono">{settings.collaboratorTableVersion.toFixed(1)}</Badge>
                        </CardDescription>
                    </div>
                     <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
                        <div className="relative flex-grow sm:flex-grow-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar colaborador..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => setIsAuditLogOpen(true)} variant="outline" className="flex-grow"><History className="mr-2 h-4 w-4" />Histórico</Button>
                            <Button onClick={() => setIsImportOpen(true)} variant="outline" className="flex-grow"><Upload className="mr-2 h-4 w-4" />Importar</Button>
                            <Button onClick={() => setIsProfileImportOpen(true)} variant="outline" className="flex-grow" title="Nascimento, entrada e gestor de quem já está cadastrado"><Upload className="mr-2 h-4 w-4" />Atualizar perfis</Button>
                            <Button onClick={handleExportCSV} variant="outline" className="flex-grow"><FileDown className="mr-2 h-4 w-4" />Exportar</Button>
                            <Button onClick={() => handleFormDialogOpen(null)} className="bg-admin-primary hover:bg-admin-primary/90 flex-grow"><PlusCircle className="mr-2 h-4 w-4" />Adicionar</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader tkey="name" label="Colaborador" />
                                    <TableHead>Unidade</TableHead>
                                    <FilterableHeader fkey="position" label="Cargo" uniqueValues={uniquePositions} />
                                    <FilterableHeader fkey="city" label="Cidade" uniqueValues={uniqueCities} />
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedCollaborators.map((item) => {
                                    return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}<br/><span className="text-xs text-muted-foreground">{item.email}</span></TableCell>
                                        <TableCell className="text-sm">{item.unitId ? unitPathLabel(orgUnitsById, item.unitId) : <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell>{item.position}</TableCell>
                                        <TableCell>{item.city}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleFormDialogOpen(item)} className="hover:bg-muted">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="hover:bg-muted" disabled={deleteCollaboratorMutation.isPending && deleteCollaboratorMutation.variables === item.id}>
                                                {deleteCollaboratorMutation.isPending && deleteCollaboratorMutation.variables === item.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                     {filteredAndSortedCollaborators.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">Nenhum colaborador encontrado.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CollaboratorAuditLogModal isOpen={isAuditLogOpen} onClose={() => setIsAuditLogOpen(false)} />
            <ProfileImportDialog open={isProfileImportOpen} onOpenChange={setIsProfileImportOpen} />

            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingCollaborator(null); setIsFormOpen(isOpen); }}>
                <DialogContent className="max-w-2xl">
                <ScrollArea className="max-h-[80vh]">
                  <div className="p-6 pt-0">
                    <DialogHeader>
                        <DialogTitle>{editingCollaborator ? 'Editar Colaborador' : 'Adicionar Colaborador'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="idVeneto">ID Veneto</Label>
                                <Input id="idVeneto" {...register('idVeneto')} placeholder="Ex: VNT001" disabled={isFormSubmitting}/>
                                {errors.idVeneto && <p className="text-sm text-destructive mt-1">{errors.idVeneto.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="name">Nome</Label>
                                <Input id="name" {...register('name')} disabled={isFormSubmitting}/>
                                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" {...register('email')} placeholder="nome.sobrenome@venetomfo.com.br" disabled={isFormSubmitting}/>
                            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="photoURL">URL da Foto (opcional)</Label>
                            <Input id="photoURL" {...register('photoURL')} placeholder="https://..." disabled={isFormSubmitting}/>
                            {errors.photoURL && <p className="text-sm text-destructive mt-1">{errors.photoURL.message}</p>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <Label htmlFor="position">Cargo</Label>
                                <Input id="position" {...register('position')} disabled={isFormSubmitting}/>
                                {errors.position && <p className="text-sm text-destructive mt-1">{errors.position.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="city">Cidade</Label>
                                <Input id="city" {...register('city')} disabled={isFormSubmitting}/>
                                {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="unitId">Unidade (estrutura)</Label>
                                <select id="unitId" {...register('unitId')} disabled={isFormSubmitting} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">— sem unidade —</option>
                                    {[...orgUnits]
                                        .sort((a, b) => unitPathLabel(orgUnitsById, a.id).localeCompare(unitPathLabel(orgUnitsById, b.id), 'pt-BR'))
                                        .map((u) => (
                                            <option key={u.id} value={u.id}>{unitPathLabel(orgUnitsById, u.id)}</option>
                                        ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">Com unidade, área, equipe e gestor vêm da estrutura (ver Pessoas › Editar estrutura).</p>
                            </div>
                            {watch('unitId') ? (
                            <div>
                                <Label htmlFor="managerOverrideIdVeneto">Gestor fora da estrutura (exceção)</Label>
                                <select id="managerOverrideIdVeneto" {...register('managerOverrideIdVeneto')} disabled={isFormSubmitting} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">— segue a estrutura —</option>
                                    {[...collaborators]
                                        .filter((c) => c.idVeneto && c.id !== editingCollaborator?.id)
                                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                                        .map((c) => (
                                            <option key={c.id} value={c.idVeneto}>{c.name} · {c.position}</option>
                                        ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">Só quando a pessoa reporta a alguém diferente do responsável da unidade.</p>
                            </div>
                            ) : (
                            <div>
                                <Label htmlFor="leaderIdVeneto">Gestor no organograma</Label>
                                <select
                                    id="leaderIdVeneto"
                                    {...register('leaderIdVeneto')}
                                    disabled={isFormSubmitting}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="">— sem gestor (topo) —</option>
                                    {[...collaborators]
                                        .filter((c) => c.idVeneto && c.id !== editingCollaborator?.id)
                                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                                        .map((c) => (
                                            <option key={c.id} value={c.idVeneto}>{c.name} · {c.position}</option>
                                        ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">Gravado pelo ID. Só para quem ainda não tem unidade.</p>
                            </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="birthDate">Data de nascimento</Label>
                                <Input id="birthDate" type="date" {...register('birthDate')} disabled={isFormSubmitting}/>
                                {errors.birthDate && <p className="text-sm text-destructive mt-1">{errors.birthDate.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="admissionDate">Na Vêneto desde</Label>
                                <Input id="admissionDate" type="date" {...register('admissionDate')} disabled={isFormSubmitting}/>
                                {errors.admissionDate && <p className="text-sm text-destructive mt-1">{errors.admissionDate.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="careerHistoryText">Histórico de cargos</Label>
                                <textarea
                                    id="careerHistoryText"
                                    {...register('careerHistoryText')}
                                    disabled={isFormSubmitting}
                                    rows={3}
                                    placeholder={"Uma linha por cargo, do mais recente: Cargo | período\nAnalista Sênior | 2024–hoje"}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                            </div>
                            <label className="md:col-span-2 flex items-start gap-2 text-sm">
                                <input type="checkbox" {...register('hubHidden')} disabled={isFormSubmitting} className="mt-0.5 h-4 w-4" />
                                <span>
                                    <span className="font-medium">Não mostrar no Hub</span>
                                    <span className="block text-xs text-muted-foreground">Some de Pessoas, do organograma e dos aniversários (contas de teste, quem saiu). O acesso ao Connect não muda.</span>
                                </span>
                            </label>
                        </div>
                        <DialogFooter className="mt-6">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isFormSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isFormSubmitting} className="bg-admin-primary hover:bg-admin-primary/90">
                                {isFormSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                  </div>
                  </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Importar Colaboradores via CSV</DialogTitle>
                        <DialogDescription>
                            Faça o upload de um arquivo CSV para adicionar múltiplos colaboradores de uma só vez.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-3">
                        <div className="p-3 rounded-md border border-amber-500/50 bg-amber-500/10 text-amber-700">
                           <div className="flex items-start gap-3">
                                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0"/>
                                <div>
                                    <p className="font-semibold text-sm">Atenção: A importação irá adicionar novos colaboradores, mas não irá atualizar ou remover os existentes.</p>
                                </div>
                           </div>
                        </div>

                        <h3 className="font-semibold text-base">Instruções:</h3>
                        <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                            <li>Crie uma planilha (no Excel, Google Sheets, etc.).</li>
                            <li>
                                <strong>Planilha Veneto (Google Sheets / Excel):</strong> exporte CSV com cabeçalhos{' '}
                                <code className="bg-muted px-1 rounded text-[11px] break-words">ID, NOME USUAL, E-MAIL, CARGO, CIDADE</code>.
                            </li>
                            <li>
                                Área, equipe e gestor <strong>não vêm mais da planilha</strong>: depois de importar, encaixe cada pessoa numa unidade (Editar › Unidade ou Pessoas › Editar estrutura).
                                Colunas como ÁREA, LÍDER, LIDERANÇA, EIXO, SEGMENTO e EQUIPE, se existirem, são ignoradas.
                            </li>
                            <li>
                                <strong>Formato legado (inglês):</strong>{' '}
                                <code className="block bg-muted p-1.5 rounded-md my-1.5 text-[11px] break-all">idVeneto,name,email,position,city</code>
                                e opcionalmente <code className="text-[11px]">photoURL</code>.
                            </li>
                             <li>A coluna `photoURL` é opcional.</li>
                            <li>Preencha as linhas com os dados de cada colaborador.</li>
                            <li>Exporte ou salve o arquivo no formato **CSV (Valores Separados por Vírgula)**.</li>
                            <li>Clique no botão abaixo para selecionar e enviar o arquivo.</li>
                        </ol>
                        <div className="flex flex-wrap gap-2">
                         <a href="/templates/modelo_colaboradores_planilha_veneto.csv" download className="inline-block" >
                            <Button variant="secondary" type="button">
                                <FileDown className="mr-2 h-4 w-4"/>
                                Modelo planilha Veneto (PT)
                            </Button>
                        </a>
                         <a href="/templates/modelo_colaboradores.csv" download className="inline-block" >
                            <Button variant="outline" type="button">
                                <FileDown className="mr-2 h-4 w-4"/>
                                Modelo legado (EN)
                            </Button>
                        </a>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={isImporting}>
                            Cancelar
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                            {isImporting ? 'Importando...' : 'Selecionar Arquivo'}
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileImport}
                        />
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

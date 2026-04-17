
"use client";
import React, { useState, useRef, useMemo } from 'react';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import type { Collaborator } from '@/contexts/CollaboratorsContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Upload, FileDown, AlertTriangle, Search, ChevronUp, ChevronDown, Table2, Filter, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import Papa from 'papaparse';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { CollaboratorAuditLogModal } from './CollaboratorAuditLogModal';

/** Quando a planilha não traz eixo/segmento. */
const DEFAULT_AXIS_SEGMENT_IMPORT = '—';

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

/** Lê célula por possíveis cabeçalhos (PT/EN). Chaves distintas evitam trocar LÍDER com LIDERANÇA. */
function pickCsvCell(m: Map<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    const nk = normCsvHeader(a);
    const v = m.get(nk);
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

function normalizeLiderancaCell(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const u = t.toUpperCase();
  if (u === 'SIM' || u === 'NÃO' || u === 'NAO') return u === 'NAO' ? 'NÃO' : u;
  return t;
}

const defaultPermissions: Collaborator["permissions"] = {
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

function mapCsvRowToCollaboratorDraft(row: CsvRow): Omit<Collaborator, 'id'> | null {
  const m = csvRowToNormMap(row);

  const idVeneto = pickCsvCell(m, 'id', 'idVeneto', 'id veneto').trim();
  const name = pickCsvCell(m, 'nome usual', 'name', 'nome');
  const email = pickCsvCell(m, 'e-mail', 'email', 'e mail').toLowerCase();
  const area = pickCsvCell(m, 'área', 'area');
  const position = pickCsvCell(m, 'cargo', 'position');
  const leader = pickCsvCell(m, 'líder', 'lider', 'leader') || '—';
  const lideranca = normalizeLiderancaCell(pickCsvCell(m, 'liderança', 'lideranca'));
  const city = pickCsvCell(m, 'cidade', 'city');

  let axis = pickCsvCell(m, 'eixo', 'axis');
  let segment = pickCsvCell(m, 'segmento', 'segment');
  if (!axis) axis = DEFAULT_AXIS_SEGMENT_IMPORT;
  if (!segment) segment = DEFAULT_AXIS_SEGMENT_IMPORT;

  const photoURL = pickCsvCell(m, 'photourl', 'photo url', 'url da foto') || '';

  if (!idVeneto || !name || !email || !area || !position || !city) return null;

  return {
    idVeneto,
    name,
    email,
    photoURL,
    axis,
    area,
    position,
    segment,
    leader,
    ...(lideranca ? { lideranca } : {}),
    city,
    permissions: defaultPermissions,
  };
}

function countConsultaLinksFilled(consultaLinks: Collaborator['consultaLinks']): number {
    if (!consultaLinks) return 0;
    return [consultaLinks.mesa, consultaLinks.cliente, consultaLinks.cx].filter(
        (s) => typeof s === 'string' && s.trim().length > 0
    ).length;
}

function csvHeadersLookValid(fieldNames: string[] | undefined): boolean {
  if (!fieldNames?.length) return false;
  const s = new Set(fieldNames.map(normCsvHeader).filter(Boolean));

  const portuguese =
    (s.has('id') || s.has('idveneto')) &&
    (s.has('nome usual') || s.has('name') || s.has('nome')) &&
    (s.has('e-mail') || s.has('email')) &&
    s.has('area') &&
    (s.has('cargo') || s.has('position')) &&
    (s.has('lider') || s.has('leader')) &&
    s.has('cidade');

  const english =
    s.has('idveneto') &&
    s.has('name') &&
    s.has('email') &&
    s.has('area') &&
    s.has('position') &&
    (s.has('lider') || s.has('leader')) &&
    s.has('city');

  return portuguese || english;
}

const consultaUrlSchema = z.string().transform((value, ctx) => {
    if (!value) return '';

    if (z.string().url().safeParse(value).success) {
        return value;
    }

    if (value.trim().startsWith('<iframe')) {
        const srcMatch = value.match(/src="([^"]+)"/);
        if (srcMatch && srcMatch[1]) {
            const url = srcMatch[1];
            if (z.string().url().safeParse(url).success) {
                return url;
            }
        }
    }

    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL inválida. Cole a URL completa ou o código de incorporação do iframe.",
    });
    return z.NEVER;
});

const collaboratorSchema = z.object({
    id: z.string().optional(),
    idVeneto: z.string().min(1, "ID Veneto é obrigatório"),
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    photoURL: z.string().url("URL da imagem inválida").optional().or(z.literal('')),
    axis: z.string().min(1, "Eixo é obrigatório"),
    area: z.string().min(1, "Área é obrigatória"),
    position: z.string().min(1, "Cargo é obrigatório"),
    segment: z.string().min(1, "Segmento é obrigatório"),
    leader: z.string().min(1, "Líder é obrigatório"),
    lideranca: z.string().optional().or(z.literal('')),
    city: z.string().min(1, "Cidade é obrigatória"),
    consultaLinks: z.object({
        mesa: consultaUrlSchema,
        cliente: consultaUrlSchema,
        cx: consultaUrlSchema,
    }).optional(),
});

type CollaboratorFormValues = z.infer<typeof collaboratorSchema>;

type CsvRow = { [key: string]: string };

type SortKey = keyof Collaborator | '';
type SortDirection = 'asc' | 'desc';

function parseCsvFile(file: File): Promise<{ rows: CsvRow[]; headers: string[] | undefined }> {
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

async function parseXlsxFile(file: File): Promise<{ rows: CsvRow[]; headers: string[] | undefined }> {
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
    const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [filters, setFilters] = useState<{ area: string[], position: string[], axis: string[], segment: string[], leader: string[], lideranca: string[], city: string[] }>({ area: [], position: [], axis: [], segment: [], leader: [], lideranca: [], city: [] });

    const { register, handleSubmit, reset, formState: { errors, isSubmitting: isFormSubmitting } } = useForm<CollaboratorFormValues>({
        resolver: zodResolver(collaboratorSchema),
    });

    const { uniqueAreas, uniquePositions, uniqueAxes, uniqueSegments, uniqueLeaders, uniqueLideranca, uniqueCities } = useMemo(() => {
        const areas = new Set<string>();
        const positions = new Set<string>();
        const axes = new Set<string>();
        const segments = new Set<string>();
        const leaders = new Set<string>();
        const liderancas = new Set<string>();
        const cities = new Set<string>();
        collaborators.forEach(c => {
            if(c.area) areas.add(c.area);
            if(c.position) positions.add(c.position);
            if(c.axis) axes.add(c.axis);
            if(c.segment) segments.add(c.segment);
            if(c.leader) leaders.add(c.leader);
            if (c.lideranca) liderancas.add(c.lideranca);
            if(c.city) cities.add(c.city);
        });
        return {
            uniqueAreas: [...areas].sort(),
            uniquePositions: [...positions].sort(),
            uniqueAxes: [...axes].sort(),
            uniqueSegments: [...segments].sort(),
            uniqueLeaders: [...leaders].sort(),
            uniqueLideranca: [...liderancas].sort(),
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
                const leaderMatch = c.leader?.toLowerCase().includes(lowercasedTerm) ?? false;
                const liderancaMatch = c.lideranca?.toLowerCase().includes(lowercasedTerm) ?? false;
                return nameMatch || emailMatch || idMatch || leaderMatch || liderancaMatch;
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
              consultaLinks: {
                mesa: collaborator.consultaLinks?.mesa || '',
                cliente: collaborator.consultaLinks?.cliente || '',
                cx: collaborator.consultaLinks?.cx || '',
              },
            });
        } else {
            reset({
                id: undefined,
                idVeneto: '',
                name: '',
                email: '',
                photoURL: '',
                axis: '',
                area: '',
                position: '',
                segment: '',
                leader: '',
                lideranca: '',
                city: '',
                consultaLinks: { mesa: '', cliente: '', cx: '' },
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
        const processedData = {
          ...data,
          idVeneto: data.idVeneto,
          lideranca: data.lideranca?.trim() || undefined,
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
                  "Cabeçalhos inválidos. Use: ID, NOME USUAL, E-MAIL, ÁREA, CARGO, LÍDER, LIDERANÇA, CIDADE (ou formato legado em inglês).",
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
                  "Arquivo lido, mas nenhuma linha pôde ser convertida. Verifique se as colunas obrigatórias estão preenchidas (ID, NOME USUAL, E-MAIL, ÁREA, CARGO, CIDADE).",
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
            axis: c.axis,
            area: c.area,
            position: c.position,
            segment: c.segment,
            leader: c.leader,
            lideranca: c.lideranca || '',
            city: c.city,
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
                                    <FilterableHeader fkey="axis" label="Eixo" uniqueValues={uniqueAxes} />
                                    <FilterableHeader fkey="area" label="Área" uniqueValues={uniqueAreas} />
                                    <FilterableHeader fkey="position" label="Cargo" uniqueValues={uniquePositions} />
                                    <FilterableHeader fkey="segment" label="Segmento" uniqueValues={uniqueSegments} />
                                    <FilterableHeader fkey="leader" label="Líder" uniqueValues={uniqueLeaders} />
                                    <FilterableHeader fkey="lideranca" label="Liderança" uniqueValues={uniqueLideranca} />
                                    <FilterableHeader fkey="city" label="Cidade" uniqueValues={uniqueCities} />
                                    <TableHead>Links Consulta</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedCollaborators.map((item) => {
                                    const consultaCount = countConsultaLinksFilled(item.consultaLinks);
                                    return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}<br/><span className="text-xs text-muted-foreground">{item.email}</span></TableCell>
                                        <TableCell>{item.axis}</TableCell>
                                        <TableCell>{item.area}</TableCell>
                                        <TableCell>{item.position}</TableCell>
                                        <TableCell>{item.segment}</TableCell>
                                        <TableCell>{item.leader}</TableCell>
                                        <TableCell>{item.lideranca || '—'}</TableCell>
                                        <TableCell>{item.city}</TableCell>
                                        <TableCell>
                                            {consultaCount > 0 ? (
                                                <Badge variant="secondary" className="flex items-center w-fit gap-1.5">
                                                    <Table2 className="h-3 w-3" />
                                                    {consultaCount} link(s)
                                                </Badge>
                                            ) : (
                                                 <Badge variant="outline">Nenhum</Badge>
                                            )}
                                        </TableCell>
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
                                <Label htmlFor="axis">Eixo</Label>
                                <Input id="axis" {...register('axis')} disabled={isFormSubmitting}/>
                                {errors.axis && <p className="text-sm text-destructive mt-1">{errors.axis.message}</p>}
                            </div>
                             <div>
                                <Label htmlFor="area">Área</Label>
                                <Input id="area" {...register('area')} disabled={isFormSubmitting}/>
                                {errors.area && <p className="text-sm text-destructive mt-1">{errors.area.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <Label htmlFor="position">Cargo</Label>
                                <Input id="position" {...register('position')} disabled={isFormSubmitting}/>
                                {errors.position && <p className="text-sm text-destructive mt-1">{errors.position.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="segment">Segmento</Label>
                                <Input id="segment" {...register('segment')} disabled={isFormSubmitting}/>
                                {errors.segment && <p className="text-sm text-destructive mt-1">{errors.segment.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="leader">Líder (nome do gestor direto)</Label>
                                <Input id="leader" {...register('leader')} disabled={isFormSubmitting} placeholder="Como na planilha RH"/>
                                {errors.leader && <p className="text-sm text-destructive mt-1">{errors.leader.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="lideranca">Liderança (SIM / NÃO ou texto livre)</Label>
                                <Input id="lideranca" {...register('lideranca')} disabled={isFormSubmitting} placeholder="SIM, NÃO…"/>
                                {errors.lideranca && <p className="text-sm text-destructive mt-1">{errors.lideranca.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Label htmlFor="city">Cidade</Label>
                                <Input id="city" {...register('city')} disabled={isFormSubmitting}/>
                                {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
                            </div>
                        </div>
                        <Separator/>
                        <div>
                            <Label>Links Consulta Pessoal (opcional)</Label>
                            <div className="space-y-3 mt-2">
                                {(['mesa', 'cliente', 'cx'] as const).map((field) => (
                                    <div key={field} className="space-y-1.5">
                                        <Label htmlFor={`consultaLinks.${field}`} className="capitalize">{field === 'cx' ? 'CX' : field.charAt(0).toUpperCase() + field.slice(1)}</Label>
                                        <Input
                                            id={`consultaLinks.${field}`}
                                            {...register(`consultaLinks.${field}`)}
                                            placeholder="Cole a URL ou o código de incorporação do iframe"
                                            disabled={isFormSubmitting}
                                        />
                                        {errors.consultaLinks?.[field] && (
                                            <p className="text-xs text-destructive mt-1">{errors.consultaLinks[field]?.message}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
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
                                <code className="bg-muted px-1 rounded text-[11px] break-words">ID, NOME USUAL, E-MAIL, ÁREA, CARGO, LÍDER, LIDERANÇA, CIDADE</code>.
                                Coluna <strong>LÍDER</strong> = nome do gestor (vai para o campo <code className="text-[11px]">leader</code>).
                                Coluna <strong>LIDERANÇA</strong> = SIM/NÃO (vai para <code className="text-[11px]">lideranca</code>). Eixo e segmento, se ausentes, viram <code className="text-[11px]">—</code>.
                            </li>
                            <li>
                                <strong>Formato legado (inglês):</strong>{' '}
                                <code className="block bg-muted p-1.5 rounded-md my-1.5 text-[11px] break-all">idVeneto,name,email,area,position,leader,city</code>
                                e opcionalmente <code className="text-[11px]">axis, segment, lideranca, photoURL</code>.
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

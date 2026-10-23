"use client";

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { parseProfileImport, type ProfileImportRow } from '@/lib/hub/profile-import';
import { parseCsvFile, parseXlsxFile } from './ManageCollaborators';

interface Summary {
  updated: number;
  unchanged: number;
  notFound: string[];
  unknownManager: string[];
  protectedSkipped: string[];
  preview: { name: string; changes: { field: string; oldValue: unknown; newValue: unknown }[] }[];
}

const FIELD_LABEL: Record<string, string> = {
  birthDate: 'nascimento',
  admissionDate: 'entrada',
  leaderIdVeneto: 'gestor (ID)',
  leader: 'líder',
};

/**
 * "Atualizar perfis por planilha": o RH sobe uma planilha com ID + as colunas que quer mudar
 * (Data de nascimento, Na Vêneto desde, ID Gestor). Mostra a prévia e só grava ao confirmar.
 */
export function ProfileImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ProfileImportRow[]>([]);
  const [lineErrors, setLineErrors] = useState<{ line: number; message: string }[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setRows([]);
    setLineErrors([]);
    setSummary(null);
  };

  const call = async (payload: ProfileImportRow[], dryRun: boolean): Promise<Summary> => {
    const token = await user?.getIdToken();
    const res = await fetch('/api/admin/collaborators/profile-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ rows: payload, dryRun }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Falha ao processar.');
    return body as Summary;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    reset();
    try {
      const { rows: raw } = /\.xlsx?$/i.test(file.name) ? await parseXlsxFile(file) : await parseCsvFile(file);
      const parsed = parseProfileImport(raw as Record<string, unknown>[]);
      setRows(parsed.rows);
      setLineErrors(parsed.errors);
      if (parsed.rows.length > 0) setSummary(await call(parsed.rows, true));
    } catch (e) {
      toast({ title: 'Erro ao ler a planilha', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const result = await call(rows, false);
      toast({ title: 'Perfis atualizados', description: `${result.updated} colaborador(es) alterado(s).` });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Não foi possível atualizar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atualizar perfis por planilha</DialogTitle>
          <DialogDescription>
            Atualiza quem já está cadastrado, pelo ID. Colunas aceitas: <b>ID</b> (obrigatória), <b>Data de nascimento</b>,{' '}
            <b>Na Vêneto desde</b> e <b>ID Gestor</b>. Só as colunas presentes mudam; célula vazia apaga o valor. Equipe e área vêm da estrutura.
            Datas em DD/MM/AAAA.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          <input ref={input} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => input.current?.click()} disabled={busy} className="justify-self-start">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Escolher planilha (CSV ou XLSX)
          </Button>

          {lineErrors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-1 font-semibold">{lineErrors.length} linha(s) ignorada(s):</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {lineErrors.slice(0, 10).map((e) => (
                  <li key={e.line}>
                    Linha {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary && (
            <div className="grid gap-2 rounded-md border p-3">
              <p>
                <b>{summary.updated}</b> colaborador(es) vão mudar · {summary.unchanged} sem mudança
              </p>
              {summary.notFound.length > 0 && <p className="text-amber-700">ID não encontrado: {summary.notFound.slice(0, 15).join(', ')}</p>}
              {summary.unknownManager.length > 0 && (
                <p className="text-amber-700">ID do gestor não existe (linhas ignoradas): {summary.unknownManager.slice(0, 15).join(', ')}</p>
              )}
              {summary.protectedSkipped.length > 0 && <p className="text-muted-foreground">Super admin (só outro super admin altera): {summary.protectedSkipped.join(', ')}</p>}
              {summary.preview.length > 0 && (
                <ul className="mt-1 grid gap-1 text-muted-foreground">
                  {summary.preview.map((p) => (
                    <li key={p.name}>
                      <span className="font-medium text-foreground">{p.name}</span>:{' '}
                      {p.changes.map((c) => `${FIELD_LABEL[c.field] ?? c.field} → ${c.newValue || '(vazio)'}`).join(' · ')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={busy || !summary || summary.updated === 0}>
            Aplicar {summary?.updated ? `(${summary.updated})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

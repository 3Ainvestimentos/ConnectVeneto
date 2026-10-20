/**
 * Planilha de "dados do Perfil" do RH: atualiza colaboradores que já existem (pelo ID Veneto) com
 * nascimento, entrada, equipe e gestor. Função pura, usada no navegador para validar e mostrar a
 * prévia antes de enviar para `POST /api/admin/collaborators/profile-import`.
 */

export interface ProfileImportRow {
  idVeneto: string;
  birthDate?: string;
  admissionDate?: string;
  team?: string;
  leaderIdVeneto?: string;
}

export interface ProfileImportResult {
  rows: ProfileImportRow[];
  /** Linhas recusadas, com o número da linha da planilha (cabeçalho = 1). */
  errors: { line: number; message: string }[];
}

const norm = (h: string) =>
  h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const HEADERS: Record<keyof ProfileImportRow, string[]> = {
  idVeneto: ['id', 'idveneto'],
  birthDate: ['datadenascimento', 'nascimento', 'aniversario', 'datadeaniversario', 'birthdate'],
  admissionDate: ['navenetodesde', 'datadeadmissao', 'admissao', 'dataentrada', 'admissiondate'],
  team: ['equipe', 'team'],
  leaderIdVeneto: ['idgestor', 'idlider', 'gestorid', 'leaderidveneto'],
};

/** "31/12/1990", "1990-12-31", Date ou serial do Excel → "1990-12-31". `''` = apagar; `null` = inválida. */
export function toIsoDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    // Serial do Excel (dias desde 1899-12-30).
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const day = Number(d);
    const month = Number(mo);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export function parseProfileImport(rows: Record<string, unknown>[]): ProfileImportResult {
  const out: ProfileImportRow[] = [];
  const errors: ProfileImportResult['errors'] = [];

  rows.forEach((raw, i) => {
    const line = i + 2;
    const cells = new Map(Object.entries(raw).map(([k, v]) => [norm(k), v]));
    const pick = (key: keyof ProfileImportRow) => {
      for (const h of HEADERS[key]) if (cells.has(h)) return cells.get(h);
      return undefined;
    };
    const has = (key: keyof ProfileImportRow) => HEADERS[key].some((h) => cells.has(h));

    const idVeneto = String(pick('idVeneto') ?? '').trim();
    if (!idVeneto) {
      if (Object.values(raw).some((v) => String(v ?? '').trim())) errors.push({ line, message: 'Sem ID.' });
      return;
    }
    const row: ProfileImportRow = { idVeneto };

    for (const key of ['birthDate', 'admissionDate'] as const) {
      if (!has(key)) continue;
      const iso = toIsoDate(pick(key));
      if (iso === null) {
        errors.push({ line, message: `Data inválida em ${key === 'birthDate' ? 'nascimento' : 'entrada'}: "${String(pick(key))}" (use DD/MM/AAAA).` });
        return;
      }
      row[key] = iso;
    }
    if (has('team')) row.team = String(pick('team') ?? '').trim();
    if (has('leaderIdVeneto')) row.leaderIdVeneto = String(pick('leaderIdVeneto') ?? '').trim();
    if (Object.keys(row).length > 1) out.push(row);
  });

  return { rows: out, errors };
}

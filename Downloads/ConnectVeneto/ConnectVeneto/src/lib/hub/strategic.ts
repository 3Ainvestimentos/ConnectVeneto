/**
 * Indicadores Estratégicos da Home a partir do `GET /api/summary` do Dados Estratégicos.
 * Contrato: dados-estrategicos/vault/api-summary.md (números crus, em fração decimal).
 */

export interface StrategicSummary {
  competencia: string;
  atualizadoEm?: string;
  aum: { valor: number; variacaoMes: number | null } | null;
  churn: { valor: number; janela: string; variacao: number | null } | null;
  roa: { valor: number; janela: string; variacao: number | null } | null;
}

export interface Indicator {
  label: string;
  hint?: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  tone: 'positive' | 'negative' | 'neutral';
}

const num = (v: number, digits: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (v: number, digits: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), digits)}`;
const trendOf = (v: number | null): Indicator['trend'] => (v === null || Math.abs(v) < 1e-9 ? 'flat' : v > 0 ? 'up' : 'down');
/** Subir é bom para os três: AuM maior, churn menos negativo (menos saída), ROA maior. */
const toneOf = (v: number | null): Indicator['tone'] => (v === null || Math.abs(v) < 1e-9 ? 'neutral' : v > 0 ? 'positive' : 'negative');

/** "R$ 7,48 bi" / "R$ 950,3 mi". */
function money(v: number): string {
  return Math.abs(v) >= 1e9 ? `R$ ${num(v / 1e9, 2)} bi` : `R$ ${num(v / 1e6, 1)} mi`;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "2026-09" → "set/2026". */
export function competenciaLabel(c: string): string {
  const [y, m] = c.split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]}/${y}` : c;
}

export function toIndicators(s: StrategicSummary): Indicator[] {
  const out: Indicator[] = [];
  if (s.aum) {
    const d = s.aum.variacaoMes;
    out.push({ label: 'AuM', hint: 'patrimônio sob gestão', value: money(s.aum.valor), delta: d === null ? '—' : `${signed(d * 100, 1)}% no mês`, trend: trendOf(d), tone: toneOf(d) });
  }
  if (s.churn) {
    const d = s.churn.variacao;
    out.push({
      label: 'Churn',
      hint: s.churn.janela === 'YTD' ? 'acumulado do ano' : s.churn.janela,
      value: `${signed(s.churn.valor * 100, 2)}%`,
      delta: d === null ? '—' : `${signed(d * 100, 2)} p.p.`,
      trend: trendOf(d),
      tone: toneOf(d),
    });
  }
  if (s.roa) {
    const d = s.roa.variacao;
    out.push({ label: 'ROA', hint: 'carteira, ao ano', value: `${num(s.roa.valor * 100, 2)}% a.a.`, delta: d === null ? '—' : `${signed(d * 100, 2)} p.p.`, trend: trendOf(d), tone: toneOf(d) });
  }
  return out;
}

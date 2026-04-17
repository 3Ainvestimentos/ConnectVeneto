type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogValue[]
  | { [key: string]: LogValue };

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|cookie|privatekey|apikey)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function redactString(value: string): string {
  if (EMAIL_PATTERN.test(value)) return REDACTED;
  if (value.length > 400) return `${value.slice(0, 400)}...`;
  return value;
}

export function redactForLogs(value: LogValue): LogValue {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactForLogs);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactForLogs(item),
      ])
    );
  }
  return value;
}

/**
 * Niveis suportados pelo logger de seguranca.
 * - `silent`: nao emite nada (recomendado para `NODE_ENV=test`).
 * - `error`: padrao; emite via console.error.
 * - `debug`: emite via console.error e permite ativar verbosidade futura.
 */
export type SecurityLogLevel = 'silent' | 'error' | 'debug';

function resolveDefaultLevel(): SecurityLogLevel {
  const raw = (process.env.SECURITY_LOG_LEVEL ?? '').trim().toLowerCase();
  if (raw === 'silent' || raw === 'error' || raw === 'debug') {
    return raw;
  }
  if (process.env.NODE_ENV === 'test') return 'silent';
  return 'error';
}

let currentLevel: SecurityLogLevel = resolveDefaultLevel();

export function getSecurityLogLevel(): SecurityLogLevel {
  return currentLevel;
}

/**
 * Permite sobrescrever o nivel em runtime.
 * Util para testes que precisam inspecionar emissoes sem depender de env.
 */
export function setSecurityLogLevel(level: SecurityLogLevel): void {
  currentLevel = level;
}

export function resetSecurityLogLevel(): void {
  currentLevel = resolveDefaultLevel();
}

export function logSecurityEvent(message: string, details?: LogValue) {
  if (currentLevel === 'silent') return;

  if (details === undefined) {
    console.error(message);
    return;
  }

  console.error(message, redactForLogs(details));
}

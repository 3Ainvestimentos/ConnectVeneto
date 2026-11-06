import type { SolicitationItemExternal } from "@/config/veneto-solicitacoes";

/**
 * Links dos itens da página Solicitações (/applications).
 *
 * Além de https:// e mailto:, um item pode apontar para uma rota do próprio Connect
 * (ex.: `/formularios-cadastro`, um módulo embarcado fora do menu lateral). Rotas
 * internas abrem na mesma aba; links externos, em nova aba.
 */

/** Caminho do próprio Connect: começa com `/`, mas não com `//` nem `/\` (URL de outra origem). */
export function isInternalHref(href: string): boolean {
  return /^\/(?![/\\])\S*$/.test(href.trim());
}

/** Aceito no editor de Admin › Conteúdo › Solicitações. */
export function isValidSolicitationHref(href: string): boolean {
  const value = href.trim();
  return /^(https?:\/\/\S+|mailto:\S+)$/i.test(value) || isInternalHref(value);
}

export type SolicitationHrefType = "internal" | "mailto" | "external";

export function solicitationHrefType(href: string): SolicitationHrefType {
  if (isInternalHref(href)) return "internal";
  if (/^mailto:/i.test(href.trim())) return "mailto";
  return "external";
}

/** `newTab` explícito prevalece; senão rota interna e mailto ficam na mesma aba. */
export function solicitationLinkTarget(
  item: Pick<SolicitationItemExternal, "href" | "newTab">
): "_blank" | undefined {
  if (item.newTab === false) return undefined;
  if (item.newTab === true) return "_blank";
  return solicitationHrefType(item.href) === "external" ? "_blank" : undefined;
}

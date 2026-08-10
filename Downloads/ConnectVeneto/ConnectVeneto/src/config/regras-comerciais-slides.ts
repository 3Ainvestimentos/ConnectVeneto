export type RegrasComerciaisSlide = {
  src: string;
  alt: string;
};

/**
 * Slide persistido no Firestore (coleção `regrasComerciaisSlides`).
 * `order` define a sequência no carrossel.
 */
export type RegrasComerciaisSlideDoc = RegrasComerciaisSlide & {
  id: string;
  order: number;
};

/**
 * Baseline versionada em código. É o que aparece enquanto a coleção
 * `regrasComerciaisSlides` estiver vazia (nenhuma edição feita ainda) e o que o
 * botão "Restaurar padrão" da tela de administração reaplica.
 */
export const defaultMixServicosSlides: RegrasComerciaisSlide[] = [
  { src: "/regras-comerciais/mix/03.png", alt: "Slide de abertura do Mix de Servicos" },
  { src: "/regras-comerciais/mix/02.png", alt: "Lembrete de politica comercial" },
  { src: "/regras-comerciais/mix/04.png", alt: "Tabela de produtos e precos" },
  { src: "/regras-comerciais/mix/05.png", alt: "Precos para carteira administrada e fundos exclusivos" },
  { src: "/regras-comerciais/mix/06.png", alt: "Precos para offshore" },
  { src: "/regras-comerciais/mix/07.png", alt: "Instituicoes do rol" },
  { src: "/regras-comerciais/mix/08.png", alt: "Instituicoes com necessidade de consulta previa" },
  { src: "/regras-comerciais/mix/09.png", alt: "Capa institucional da Veneto para o Mix de Servicos" },
];

/** @deprecated Use `useMixServicosSlides()` para ler os slides vigentes (Firestore + fallback). */
export const mixServicosSlides = defaultMixServicosSlides;

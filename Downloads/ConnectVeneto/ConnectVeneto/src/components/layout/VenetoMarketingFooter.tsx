import type { ReactNode } from "react";
import Image from "next/image";
import { Instagram, Linkedin } from "lucide-react";
import logoVenetoLight from "../../../docs/PNG/logotipo_vênetoPrancheta_3_upscaled.png";

const SOCIAL_LINKS = [
  {
    href: "https://www.instagram.com/venetomfo/",
    label: "Instagram da Vêneto Family Office",
    Icon: Instagram,
  },
  {
    href: "https://www.linkedin.com/company/venetofamilyoffice/",
    label: "LinkedIn da Vêneto Family Office",
    Icon: Linkedin,
  },
] as const;

type VenetoMarketingFooterProps = {
  /** Texto legal opcional acima da barra (ex.: termos e privacidade). */
  legalSlot?: ReactNode;
  /**
   * `flow` — bloco no fim do conteúdo (ex.: dashboard).
   * `fixed` — colado ao rodapé da viewport (ex.: landing em tela cheia).
   */
  variant?: "flow" | "fixed";
};

export function VenetoMarketingFooter({
  legalSlot,
  variant = "flow",
}: VenetoMarketingFooterProps) {
  const positionClass =
    variant === "fixed"
      ? "absolute bottom-0 left-0 right-0 z-20 w-full"
      : "relative z-10 w-full";

  return (
    <footer className={positionClass}>
      {legalSlot != null ? (
        <div className="bg-header/95 px-4 py-1.5 text-center text-[10px] leading-snug text-header-foreground/55">
          {legalSlot}
        </div>
      ) : null}
      <div className="flex h-[var(--header-height)] w-full items-center justify-center border-t border-header-foreground/10 bg-header px-4 md:px-6">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Image
            src={logoVenetoLight}
            alt="Vêneto Family Office"
            width={160}
            height={40}
            className="h-7 w-auto shrink-0 object-contain md:h-[41px]"
          />
          <div
            className="h-7 w-px shrink-0 bg-header-foreground/70 md:h-10"
            aria-hidden
          />
          <nav
            className="flex items-center gap-2"
            aria-label="Redes sociais"
          >
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-header-foreground/90 text-header-foreground transition-colors hover:bg-header-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground md:h-10 md:w-10"
              >
                <Icon className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={1.75} />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

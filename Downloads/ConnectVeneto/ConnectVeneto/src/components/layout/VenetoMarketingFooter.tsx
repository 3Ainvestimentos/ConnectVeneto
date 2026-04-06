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
};

export function VenetoMarketingFooter({ legalSlot }: VenetoMarketingFooterProps) {
  return (
    <footer className="absolute bottom-0 left-0 right-0 z-20 w-full">
      {legalSlot != null ? (
        <div className="bg-[#0d1d2c]/95 px-4 py-1.5 text-center text-[10px] leading-snug text-white/55">
          {legalSlot}
        </div>
      ) : null}
      <div className="flex items-center justify-center border-t border-white/10 bg-[#0d1d2c] px-4 py-2">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Image
            src={logoVenetoLight}
            alt="Vêneto Family Office"
            width={160}
            height={40}
            className="h-7 w-auto shrink-0 sm:h-8"
          />
          <div className="h-6 w-px shrink-0 bg-white/70 sm:h-8" aria-hidden />
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
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/90 text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

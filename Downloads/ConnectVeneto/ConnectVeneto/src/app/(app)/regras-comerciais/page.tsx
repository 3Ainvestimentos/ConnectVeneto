"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/layout/PageHeader";
import { VenetoImageCarousel } from "@/components/regras-comerciais/VenetoImageCarousel";
import { venetoRepositoryDocuments } from "@/config/veneto-documentos";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentsContext";
import { useMixServicosSlides } from "@/hooks/useMixServicosSlides";
import { mergeStaticAndFirestoreDocuments } from "@/lib/document-repository-utils";

const MANUAL_REGRAS_CONTROLES_ID = "veneto-manual-regras-controles";
const MANUAL_REGRAS_CONTROLES_FALLBACK_URL = venetoRepositoryDocuments.find(
  (doc) => doc.id === MANUAL_REGRAS_CONTROLES_ID
)!.downloadUrl;

const politicaItems = [
  {
    label: "Até 28/06:",
    text: "Grupos Familiares abaixo de R$5mm terão comissionamento normal, desde que estejam acima de R$1mm em até 6 meses, abaixo de R$1mm ficarão sem comissionamento (31/12/2022).",
  },
  {
    label: "Após 28/06:",
    text: "Grupos familiares abaixo de R$5mm, Offshore abaixo de US$ 500k e Fundos Exclusivos com receita abaixo de R$ 3.000,00 no mês não terão comissionamento caso estejam fora de enquadramento após 120 dias.",
  },
  {
    label: "Após 03/02:",
    text: "Novos grupos familiares com média acima de R$3mm.",
    muted: true,
  },
];

export default function RegrasComerciais() {
  const { documents } = useDocuments();
  const { permissions, isSuperAdmin } = useAuth();
  const { slides: mixSlides } = useMixServicosSlides();

  const canManageSlides = isSuperAdmin || permissions.canManageRegrasComerciais;

  const manualUrl = useMemo(() => {
    const merged = mergeStaticAndFirestoreDocuments(documents, venetoRepositoryDocuments);
    return (
      merged.find((doc) => doc.id === MANUAL_REGRAS_CONTROLES_ID)?.downloadUrl ??
      MANUAL_REGRAS_CONTROLES_FALLBACK_URL
    );
  }, [documents]);

  return (
    <div className="space-y-10 p-6 md:p-8">
      <PageHeader
        title="Regras Comerciais"
        description="Mix de Serviços da Vêneto Family Office."
      />

      {/* ── Manual de Regras e Controles Internos ── */}
      <section aria-labelledby="manual-heading" className="space-y-4">
        <h2
          id="manual-heading"
          className="text-xl font-headline font-bold text-foreground border-b border-border pb-2"
        >
          Manual de Regras e Controles Internos
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border bg-card p-6">
          <div className="rounded-full bg-[#e1ca5f]/10 p-3 shrink-0">
            <FileText className="h-6 w-6 text-[#e1ca5f]" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-body text-sm text-foreground">
              Acesse aqui o documento com as descrições de todas as regras comerciais.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <a href={manualUrl} target="_blank" rel="noopener noreferrer">
              Abrir manual
            </a>
          </Button>
        </div>
      </section>

      {/* ── Mix de Serviços ── */}
      <section aria-labelledby="mix-heading" className="space-y-6">
        <h2
          id="mix-heading"
          className="text-xl font-headline font-bold text-foreground border-b border-border pb-2"
        >
          Mix de Serviços
        </h2>

        {/* Lembrete: Política comercial */}
        <div className="border-l-4 border-[#e1ca5f] pl-4 space-y-3">
          <h3 className="text-base font-headline font-semibold text-foreground">
            Lembrete: Política comercial
          </h3>
          <ul className="space-y-3">
            {politicaItems.map((item) => (
              <li key={item.label} className="font-body text-sm">
                <span className="font-semibold">{item.label}</span>{" "}
                <span className={item.muted ? "text-[#e1ca5f]" : "text-foreground"}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Apresentação Mix de Serviços */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-headline font-semibold text-foreground">
              Apresentação — Mix de Serviços
            </h3>
            {canManageSlides && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                    >
                      <Link
                        href="/admin/regras-comerciais"
                        aria-label="Editar as imagens da apresentação"
                      >
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar as imagens da apresentação</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="px-6">
            <VenetoImageCarousel slides={mixSlides} label="Mix de Serviços" />
          </div>
        </div>
      </section>
    </div>
  );
}

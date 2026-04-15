"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { VenetoImageCarousel } from "@/components/regras-comerciais/VenetoImageCarousel";
import {
  frameworkR1Slides,
  frameworkR1OffshoreSlides,
  frameworkR2Slides,
  frameworkR3Slides,
  mixServicosSlides,
} from "@/config/regras-comerciais-slides";

const frameworkSections = [
  { id: "r1", title: "Framework R1", slides: frameworkR1Slides },
  { id: "r1-offshore", title: "Framework R1 | Offshore", slides: frameworkR1OffshoreSlides },
  { id: "r2", title: "Framework R2", slides: frameworkR2Slides },
  { id: "r3", title: "Framework R3", slides: frameworkR3Slides },
];

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
  return (
    <div className="space-y-10 p-6 md:p-8">
      <PageHeader
        title="Regras Comerciais"
        description="Framework de reuniões e Mix de Serviços da Vêneto Family Office."
      />

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
          <h3 className="text-base font-headline font-semibold text-foreground">
            Apresentação — Mix de Serviços
          </h3>
          <div className="px-6">
            <VenetoImageCarousel
              slides={mixServicosSlides}
              label="Mix de Serviços"
            />
          </div>
        </div>
      </section>

      {/* ── Framework de Reuniões ── */}
      <section aria-labelledby="framework-heading" className="space-y-8">
        <h2
          id="framework-heading"
          className="text-xl font-headline font-bold text-foreground border-b border-border pb-2"
        >
          Framework de Reuniões
        </h2>

        <div className="space-y-10">
          {frameworkSections.map((section) => (
            <div key={section.id} className="space-y-4">
              <h3 className="text-base font-headline font-semibold text-foreground">
                {section.title}
              </h3>
              <div className="px-6">
                <VenetoImageCarousel
                  slides={section.slides}
                  label={section.title}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

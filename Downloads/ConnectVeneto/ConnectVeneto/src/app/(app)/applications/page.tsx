"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import VenetoSolicitacoesHub from "@/components/applications/VenetoSolicitacoesHub";

export default function ApplicationsPage() {
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col justify-center px-4 py-6 sm:px-6 md:px-8 lg:px-10">
      <div className="w-full max-w-none">
        <PageHeader
          title="Solicitações"
          align="center"
          description="Inicie processos e acesse formularios e materiais da instituicao. O acompanhamento de cada pedido fica no canal correspondente (formulario ou equipe), pois esta pagina apenas direciona aos links."
        />
        <VenetoSolicitacoesHub />
      </div>
    </div>
  );
}

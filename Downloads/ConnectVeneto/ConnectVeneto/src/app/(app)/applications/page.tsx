"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import VenetoSolicitacoesHub from "@/components/applications/VenetoSolicitacoesHub";

export default function ApplicationsPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader
        title="Solicitações"
        description="Inicie processos e acesse formularios e materiais da instituicao. O acompanhamento de cada pedido fica no canal correspondente (formulario ou equipe), pois esta pagina apenas direciona aos links."
      />
      <div className="w-full max-w-none">
        <VenetoSolicitacoesHub />
      </div>
    </div>
  );
}

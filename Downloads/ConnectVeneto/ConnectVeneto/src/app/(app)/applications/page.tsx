"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import VenetoSolicitacoesHub from "@/components/applications/VenetoSolicitacoesHub";

export default function ApplicationsPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader
        title="Solicitações"
        description="Inicie processos e acesse formulários e materiais da instituição. O acompanhamento de cada pedido fica no canal correspondente (formulário ou equipe); os pedidos abertos pelo TrackFlow são acompanhados no próprio TrackFlow, em Meus tickets."
      />
      <div className="w-full max-w-none">
        <VenetoSolicitacoesHub />
      </div>
    </div>
  );
}

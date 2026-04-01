"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import MyRequests from "@/components/applications/MyRequests";
import VenetoSolicitacoesHub from "@/components/applications/VenetoSolicitacoesHub";

export default function ApplicationsPage() {
  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <PageHeader
          title="Solicitações"
          description="Inicie processos e acesse formularios e materiais da instituicao."
        />
        <VenetoSolicitacoesHub />
      </div>

      <Separator />

      <MyRequests />
    </div>
  );
}

"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import VenetoAreaLogadaCards from "@/components/area-logada/VenetoAreaLogadaCards";

export default function AreaLogadaPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader
        title="Área Logada"
        description="Acesse o relatório virtual, o terminal de consulta e a área do cliente. Os serviços abrem em uma nova aba."
      />
      <div className="w-full max-w-none">
        <VenetoAreaLogadaCards />
      </div>
    </div>
  );
}

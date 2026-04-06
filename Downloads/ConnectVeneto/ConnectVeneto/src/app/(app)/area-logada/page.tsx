"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import VenetoAreaLogadaCards from "@/components/area-logada/VenetoAreaLogadaCards";

export default function AreaLogadaPage() {
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col justify-center px-4 py-6 sm:px-6 md:px-8 lg:px-10">
      <div className="w-full max-w-none space-y-10">
        <PageHeader
          title="Área Logada"
          align="center"
          description="Acesse o relatório virtual, o terminal de consulta e a área do cliente. Os serviços abrem em uma nova aba."
        />
        <VenetoAreaLogadaCards />
      </div>
    </div>
  );
}

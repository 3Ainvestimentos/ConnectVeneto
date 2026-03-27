"use client";

import { PageHeader } from '@/components/layout/PageHeader';
import { useLabs } from '@/contexts/LabsContext';
import type { LabType } from '@/contexts/LabsContext';
import LabsRepositoryClient from '@/components/labs/LabsRepositoryClient';

export default function LabsPage() {
  const { labs, loading } = useLabs();
  const categories = Array.from(new Set(labs.map(lab => lab.category)));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader
        title="Labs"
        description="Repositório de vídeos de treinamento, painéis e outros materiais de estudo."
      />
      <LabsRepositoryClient initialLabs={labs} categories={categories} loading={loading} />
    </div>
  );
}

export type { LabType };

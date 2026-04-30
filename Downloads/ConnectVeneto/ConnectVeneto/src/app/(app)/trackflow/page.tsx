"use client";

import { PageHeader } from '@/components/layout/PageHeader';
import TrackFlowEmbed from '@/components/dashboard-v2/TrackFlowEmbed';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

export default function TrackFlowPage() {
  return (
    <div className="flex flex-col gap-4 p-6 md:p-8 h-full">
      <PageHeader
        title="TrackFlow"
        description="Gerencie e acompanhe suas solicitações."
      />
      <div className="flex-1 rounded-xl overflow-hidden border border-border bg-background shadow-sm min-h-[75vh]">
        <WidgetErrorBoundary title="TrackFlow indisponível">
          <TrackFlowEmbed fullHeight />
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}

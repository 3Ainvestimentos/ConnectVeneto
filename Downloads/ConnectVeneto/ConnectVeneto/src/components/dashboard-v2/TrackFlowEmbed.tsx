'use client';

import ModuleEmbed from '@/components/embeds/ModuleEmbed';

export default function TrackFlowEmbed({ fullHeight }: { fullHeight?: boolean }) {
  return (
    <ModuleEmbed
      moduleId="trackflow"
      title="TrackFlow — Solicitações"
      className={`relative w-full ${fullHeight ? 'h-full min-h-[calc(100vh-12rem)]' : 'h-full min-h-[680px]'}`}
      iframeClassName="rounded-lg"
    />
  );
}

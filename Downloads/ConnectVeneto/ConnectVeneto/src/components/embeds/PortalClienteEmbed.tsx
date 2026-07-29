'use client';

import ModuleEmbed from '@/components/embeds/ModuleEmbed';

export default function PortalClienteEmbed() {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <ModuleEmbed
        moduleId="portal-cliente"
        title="Portal do Cliente"
        className="relative w-full h-full"
      />
    </div>
  );
}

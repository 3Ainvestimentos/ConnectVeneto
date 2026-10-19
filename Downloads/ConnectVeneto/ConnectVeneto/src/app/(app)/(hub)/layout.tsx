import { HubPilotGate } from '@/components/hub-feed/HubPilotGate';
import { HubMockProvider } from '@/lib/hub-mock/store';

/**
 * Rotas do Hub de Comunicação (/inicio, /publicacoes, /pessoas). Só para quem está no piloto.
 * O feed usa dados reais (/api/feed); pessoas, viagens e férias ainda vêm do mock local.
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <HubPilotGate>
      <HubMockProvider>{children}</HubMockProvider>
    </HubPilotGate>
  );
}

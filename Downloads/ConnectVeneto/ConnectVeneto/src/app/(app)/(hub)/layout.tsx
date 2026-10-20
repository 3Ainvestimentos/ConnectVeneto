import { HubPilotGate } from '@/components/hub-feed/HubPilotGate';

/**
 * Rotas do Hub de Comunicação (/inicio, /publicacoes, /pessoas). Só para quem está no piloto.
 * Tudo com dados reais: feed (/api/feed), pessoas do cadastro de colaboradores, viagens
 * (leaderTrips) e férias aprovadas (vacation_requests).
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <HubPilotGate>{children}</HubPilotGate>;
}

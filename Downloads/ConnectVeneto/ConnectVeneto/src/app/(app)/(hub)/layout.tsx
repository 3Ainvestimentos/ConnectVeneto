import { HubMockProvider } from '@/lib/hub-mock/store';

/** Rotas do wireframe do Hub de Comunicação (/inicio, /pessoas). Estado local, sem Firestore. */
export default function HubWireframeLayout({ children }: { children: React.ReactNode }) {
  return <HubMockProvider>{children}</HubMockProvider>;
}

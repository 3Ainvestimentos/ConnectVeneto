import PortalClienteEmbed from '@/components/embeds/PortalClienteEmbed';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

export default function PortalClientePage() {
  return (
    <WidgetErrorBoundary title="Portal do Cliente indisponível">
      <PortalClienteEmbed />
    </WidgetErrorBoundary>
  );
}

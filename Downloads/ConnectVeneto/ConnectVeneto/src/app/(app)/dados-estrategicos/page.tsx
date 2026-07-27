import PortalRepasseEmbed from '@/components/embeds/PortalRepasseEmbed';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

export default function PortalRepassePage() {
  return (
    <WidgetErrorBoundary title="Dados Estratégicos indisponível">
      <PortalRepasseEmbed />
    </WidgetErrorBoundary>
  );
}

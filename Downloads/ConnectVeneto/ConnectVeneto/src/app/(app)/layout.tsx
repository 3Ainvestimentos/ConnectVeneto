
import AppLayoutWrapper from '@/components/layout/AppLayout';
import AppProviders from './providers/AppProviders';


export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <AppLayoutWrapper>{children}</AppLayoutWrapper>
    </AppProviders>
  );
}

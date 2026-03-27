
import AppLayoutWrapper from '@/components/layout/AppLayout';
import AppProviders from './providers/AppProviders';
import { AppErrorBoundary } from '@/components/error/AppErrorBoundary';


export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <AppErrorBoundary>
        <AppLayoutWrapper>{children}</AppLayoutWrapper>
      </AppErrorBoundary>
    </AppProviders>
  );
}

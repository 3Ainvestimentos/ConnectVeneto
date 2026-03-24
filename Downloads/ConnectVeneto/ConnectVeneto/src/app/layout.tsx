
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Roboto, Archivo } from 'next/font/google';
import AppProviders from '@/components/providers/AppProviders';


const fontRoboto = Roboto({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-roboto',
});

const fontArchivo = Archivo({
  subsets: ['latin'],
  weight: ['300'],
  variable: '--font-archivo',
});


export const metadata: Metadata = {
  title: 'Vêneto Connect',
  description: 'Plataforma interna Veneto Family Office',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={cn("font-sans antialiased", fontRoboto.variable, fontArchivo.variable)}>
        <AppProviders>
            {children}
            <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}


"use client";

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import { SystemSettingsProvider } from '@/contexts/SystemSettingsContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ReactQueryProvider>
        <SystemSettingsProvider>
          <AuthProvider>{children}</AuthProvider>
        </SystemSettingsProvider>
      </ReactQueryProvider>
    </ThemeProvider>
  );
}

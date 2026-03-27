
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';

// Re-exporting from WorkflowsContext to avoid duplication
export type { WorkflowRequest, WorkflowStatus, WorkflowHistoryLog } from './WorkflowsContext';

type RequestsContextType = Record<string, never>;

// Creating a dummy context for now as AppLayout needs a provider.
// This can be expanded or removed if not needed.
const RequestsContext = createContext<RequestsContextType | undefined>(undefined);

export const RequestsProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo(() => ({
    // Context can be expanded with specific request management logic later
  }), []);

  return (
    <RequestsContext.Provider value={value}>
      {children}
    </RequestsContext.Provider>
  );
};

export const useRequests = (): RequestsContextType => {
  const context = useContext(RequestsContext);
  if (context === undefined) {
    throw new Error('useRequests must be used within a RequestsProvider');
  }
  return context;
};

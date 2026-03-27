"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("AppErrorBoundary capturou um erro:", error);
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-[70vh] w-full items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-lg border bg-card p-6 text-center shadow-sm">
            <div className="mb-4 flex justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="font-headline text-xl">Algo deu errado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ocorreu uma falha inesperada na aplicação. Tente recarregar a página.
            </p>
            <Button className="mt-5" onClick={this.handleReload}>
              Recarregar página
            </Button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

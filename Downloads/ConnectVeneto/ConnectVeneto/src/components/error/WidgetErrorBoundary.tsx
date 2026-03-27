"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

type WidgetErrorBoundaryProps = {
  children: React.ReactNode;
  title?: string;
};

type WidgetErrorBoundaryState = {
  hasError: boolean;
};

export class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("WidgetErrorBoundary capturou um erro:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {this.props.title || "Widget indisponível"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Não foi possível carregar este componente no momento.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

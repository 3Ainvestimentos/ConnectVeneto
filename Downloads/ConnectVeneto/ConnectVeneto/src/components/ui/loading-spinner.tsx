import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  /** @deprecated Mantido apenas por compatibilidade; o spinner padronizado nao exibe texto. */
  message?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <Loader2 className={cn("h-10 w-10 animate-spin text-admin-primary", className)} />
  );
}

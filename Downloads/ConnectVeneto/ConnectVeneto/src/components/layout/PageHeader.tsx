
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  icon?: LucideIcon;
  description?: string;
  actions?: React.ReactNode;
  /** Centraliza título e descrição (útil em hubs com grid centrado). */
  align?: "left" | "center";
}

export function PageHeader({ title, icon: Icon, description, actions, align = "left" }: PageHeaderProps) {
  const isCenter = align === "center";
  return (
    <div
      className={`mb-6 flex flex-col gap-4 ${
        isCenter
          ? "items-center text-center sm:flex-col"
          : "items-start sm:flex-row sm:items-center justify-between"
      }`}
    >
      <div className={isCenter ? "flex flex-col items-center" : ""}>
        <div className={`flex items-center gap-3 ${isCenter ? "justify-center" : ""}`}>
          {Icon ? <Icon className="h-6 w-6 text-muted-foreground" /> : null}
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-foreground">{title}</h1>
        </div>
        {description && (
          <p
            className={`mt-1 text-sm text-muted-foreground font-body ${isCenter ? "max-w-2xl" : ""}`}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

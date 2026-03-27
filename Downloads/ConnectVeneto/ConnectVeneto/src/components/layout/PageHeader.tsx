
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  icon?: LucideIcon;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, icon: Icon, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          {Icon ? <Icon className="h-6 w-6 text-muted-foreground" /> : null}
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-foreground">{title}</h1>
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground font-body">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

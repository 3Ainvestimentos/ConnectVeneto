"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useHubModules } from '@/hooks/useHubModules';
import { isSafeRelativePath, type HubNotification } from '@/lib/notifications/types';
import type { HubModule } from '@/config/modules';

/** Destino do clique: módulo embarcado abre no iframe via ?to=, o resto é rota do hub. */
function resolveHref(n: HubNotification, modules: HubModule[]): string | null {
  const link = n.link;
  if (!link || !isSafeRelativePath(link.path)) return null;
  if (!link.moduleId) return link.path;
  const mod = modules.find((m) => m.id === link.moduleId);
  if (!mod) return null;
  return link.path === '/' ? mod.href : `${mod.href}?to=${encodeURIComponent(link.path)}`;
}

/**
 * Central de Notificações — sino ao lado do avatar. Somente leitura:
 * abrir o sino marca como lidas as notificações comuns; as de módulos com
 * readPolicy 'on_resolve' (ex.: TrackFlow) só saem quando a pendência é executada.
 */
export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markOpenedAsRead } = useNotifications();
  const { modules } = useHubModules();
  const [open, setOpen] = useState(false);
  // Mantém o destaque das que estavam não lidas ao abrir, mesmo após marcá-las.
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const moduleLabel = useMemo(() => {
    const map = new Map(modules.map((m) => [m.id, m.label]));
    return (source: string) => (source === 'connect' ? 'Connect' : map.get(source) ?? source);
  }, [modules]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setHighlighted(new Set(notifications.filter((n) => !n.read).map((n) => n.id)));
      void markOpenedAsRead();
    }
  };

  const handleClick = (n: HubNotification) => {
    const href = resolveHref(n, modules);
    if (!href) return;
    setOpen(false);
    router.push(href);
  };

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full text-header-foreground/80 hover:text-header-foreground"
          aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-headline text-sm font-semibold">Notificações</h2>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} pendente{unreadCount > 1 ? 's' : ''}</span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <BellOff className="h-6 w-6" />
            Nenhuma notificação por aqui.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <ul className="divide-y">
              {notifications.map((n) => {
                const href = resolveHref(n, modules);
                const isUnread = !n.read || highlighted.has(n.id);
                const Wrapper = href ? 'button' : 'div';
                return (
                  <li key={n.id}>
                    <Wrapper
                      {...(href ? { type: 'button' as const, onClick: () => handleClick(n) } : {})}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left',
                        href && 'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                        isUnread && 'bg-muted/30',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', isUnread ? 'bg-primary' : 'bg-transparent')}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {moduleLabel(n.source)}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDistanceToNow(n.createdAt, { addSuffix: true, locale: ptBR })}
                          </span>
                        </span>
                        <span className={cn('block text-sm', isUnread ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                        {n.body && <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                        {n.readPolicy === 'on_resolve' && !n.read && (
                          <span className="mt-1 block text-[11px] text-muted-foreground">Some quando a pendência for concluída</span>
                        )}
                      </span>
                    </Wrapper>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

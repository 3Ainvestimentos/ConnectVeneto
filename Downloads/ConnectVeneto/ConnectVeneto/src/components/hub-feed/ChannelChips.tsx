"use client";

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeedChannel } from '@/lib/hub/model';

/** Filtro de canais em linha. Canais não seguidos aparecem tracejados: clicar passa a seguir. */
export function ChannelChips({
  channels,
  channelFilter,
  onChannelFilter,
  onFollow,
  className,
}: {
  channels: FeedChannel[];
  channelFilter: string;
  onChannelFilter: (id: string) => void;
  onFollow: (channelId: string, following: boolean) => void;
  className?: string;
}) {
  const followed = channels.filter((c) => c.following);
  const others = channels.filter((c) => !c.following);
  const chip = (active: boolean) =>
    cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
      active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
    );
  return (
    <div className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:px-0 [scrollbar-width:none]', className)} role="group" aria-label="Canais">
      <button type="button" className={chip(channelFilter === 'all')} onClick={() => onChannelFilter('all')}>
        Tudo
      </button>
      {followed.map((c) => (
        <button key={c.id} type="button" className={chip(channelFilter === c.id)} onClick={() => onChannelFilter(c.id)}>
          {c.name}
        </button>
      ))}
      {others.map((c) => (
        <button key={c.id} type="button" className={cn(chip(false), 'border-dashed text-muted-foreground')} onClick={() => onFollow(c.id, true)} title="Seguir canal">
          <Plus className="h-3.5 w-3.5" /> {c.name}
        </button>
      ))}
    </div>
  );
}

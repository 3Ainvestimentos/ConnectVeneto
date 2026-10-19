"use client";

import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useHubFeed } from '@/hooks/useHubFeed';
import { FeedPost } from './FeedPost';

/**
 * Uma publicação inteira (reações, presença, comentários) por cima da Home. Lê o post do cache do
 * feed, então as ações otimistas aparecem na hora dentro do diálogo.
 */
export function PostDialog({ postId, onOpenChange }: { postId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data } = useHubFeed();
  const post = postId ? data?.posts.find((p) => p.id === postId) : undefined;
  const channelName = post ? (data?.channels.find((c) => c.id === post.channelId)?.name ?? '') : '';

  return (
    <Dialog open={!!postId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{post?.title ?? 'Publicação'}</DialogTitle>
        {post && data ? (
          <FeedPost post={post} channelName={channelName} viewerEmail={data.viewer.email} inDialog />
        ) : (
          <div className="grid gap-2 p-8 text-center">
            <p className="font-medium">Publicação não encontrada.</p>
            <p className="text-sm text-muted-foreground">Ela pode ter sido arquivada ou já ter saído do ar.</p>
            <Link href="/publicacoes" className="text-sm font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
              Ver todas as publicações
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

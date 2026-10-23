"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useHubFeed, useHubFeedActions } from '@/hooks/useHubFeed';
import { postKind } from '@/lib/hub/model';
import { FeedPost } from './FeedPost';

/**
 * Uma publicação inteira (reações, presença, comentários) por cima da Home. Lê o post do cache do
 * feed, então as ações otimistas aparecem na hora dentro do diálogo. Evento tem "Excluir evento" à
 * vista para quem pode (autor, Comunicação e super admin).
 */
export function PostDialog({ postId, onOpenChange }: { postId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data } = useHubFeed();
  const { updatePost } = useHubFeedActions();
  const [deleting, setDeleting] = useState(false);
  const post = postId ? data?.posts.find((p) => p.id === postId) : undefined;
  const channelName = post ? (data?.channels.find((c) => c.id === post.channelId)?.name ?? '') : '';
  const canDeleteEvent = !!post && post.canManage && postKind(post) === 'evento';

  const deleteEvent = async () => {
    if (!post || !window.confirm(`Excluir o evento "${post.title}"? Ele sai da Agenda e as confirmações de presença deixam de valer.`)) return;
    setDeleting(true);
    try {
      await updatePost.mutateAsync({ postId: post.id, patch: { status: 'archived' } });
      toast({ title: 'Evento excluído', description: 'Ele saiu da Agenda e Eventos.' });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Não foi possível excluir', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!postId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{post?.title ?? 'Publicação'}</DialogTitle>
        {post && data ? (
          <>
            <FeedPost post={post} channelName={channelName} viewerEmail={data.viewer.email} inDialog />
            {canDeleteEvent && (
              <div className="flex justify-end border-t px-4 py-3">
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void deleteEvent()} disabled={deleting}>
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Excluir evento
                </Button>
              </div>
            )}
          </>
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

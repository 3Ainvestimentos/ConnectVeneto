import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { reactionSchema } from '@/lib/hub/model';
import { setReaction } from '@/lib/hub/repository';

/** `emoji: null` remove a reação. */
export const PUT = hubRoute<{ postId: string }>('posts:reaction', async ({ viewer, request, params }) => {
  const { emoji } = reactionSchema.parse(await readJson(request));
  await setReaction(viewer, params.postId, emoji);
  return jsonOk({ ok: true });
});

import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { voteSchema } from '@/lib/hub/model';
import { vote } from '@/lib/hub/repository';

export const POST = hubRoute<{ postId: string }>('posts:vote', async ({ viewer, request, params }) => {
  const { optionIndex } = voteSchema.parse(await readJson(request));
  await vote(viewer, params.postId, optionIndex);
  return jsonOk({ ok: true });
});

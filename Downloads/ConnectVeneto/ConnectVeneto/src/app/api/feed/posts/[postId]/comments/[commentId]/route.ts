import { z } from 'zod';
import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { setCommentRelevant } from '@/lib/hub/repository';

const schema = z.object({ relevant: z.boolean() });

/** Só o autor da publicação (ou a Comunicação) marca um comentário como relevante. */
export const PATCH = hubRoute<{ postId: string; commentId: string }>('comments:relevant', async ({ viewer, request, params }) => {
  const { relevant } = schema.parse(await readJson(request));
  await setCommentRelevant(viewer, params.postId, params.commentId, relevant);
  return jsonOk({ ok: true });
});

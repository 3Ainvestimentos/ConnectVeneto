import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { commentSchema } from '@/lib/hub/model';
import { addComment, listComments } from '@/lib/hub/repository';

export const GET = hubRoute<{ postId: string }>('comments:list', async ({ viewer, params }) => {
  return jsonOk({ comments: await listComments(viewer, params.postId) });
});

export const POST = hubRoute<{ postId: string }>('comments:create', async ({ viewer, request, params }) => {
  const { text } = commentSchema.parse(await readJson(request));
  const comment = await addComment(viewer, params.postId, text);
  return jsonOk({ comment }, 201);
});

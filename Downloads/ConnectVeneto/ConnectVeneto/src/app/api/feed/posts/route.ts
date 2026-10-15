import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { createPostSchema } from '@/lib/hub/model';
import { createPost } from '@/lib/hub/repository';

export const POST = hubRoute('posts:create', async ({ viewer, request }) => {
  const input = createPostSchema.parse(await readJson(request));
  const post = await createPost(viewer, input);
  return jsonOk({ post }, 201);
});

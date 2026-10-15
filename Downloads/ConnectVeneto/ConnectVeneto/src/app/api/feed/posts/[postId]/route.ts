import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { updatePostSchema } from '@/lib/hub/model';
import { updatePost } from '@/lib/hub/repository';

/** Autor ou Comunicação: editar texto/destaque ou arquivar (status 'archived'). */
export const PATCH = hubRoute<{ postId: string }>('posts:update', async ({ viewer, request, params }) => {
  const patch = updatePostSchema.parse(await readJson(request));
  await updatePost(viewer, params.postId, patch);
  return jsonOk({ ok: true });
});

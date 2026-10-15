import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { rsvpSchema } from '@/lib/hub/model';
import { setRsvp } from '@/lib/hub/repository';

/** `answer: null` desfaz a resposta. */
export const PUT = hubRoute<{ postId: string }>('posts:rsvp', async ({ viewer, request, params }) => {
  const { answer } = rsvpSchema.parse(await readJson(request));
  await setRsvp(viewer, params.postId, answer);
  return jsonOk({ ok: true });
});

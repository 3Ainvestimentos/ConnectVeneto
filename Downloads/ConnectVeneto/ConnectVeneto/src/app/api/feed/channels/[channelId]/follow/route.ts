import { hubRoute, jsonOk, readJson } from '@/lib/hub/http';
import { followSchema } from '@/lib/hub/model';
import { getChannel, setFollow } from '@/lib/hub/repository';

export const PUT = hubRoute<{ channelId: string }>('channels:follow', async ({ viewer, request, params }) => {
  const { following, notify } = followSchema.parse(await readJson(request));
  if (!(await getChannel(params.channelId))) throw new Error('HUB_NOT_FOUND');
  await setFollow(viewer.email, params.channelId, following, notify);
  return jsonOk({ ok: true });
});

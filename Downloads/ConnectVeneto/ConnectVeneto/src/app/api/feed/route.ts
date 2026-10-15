import { hubRoute, jsonOk } from '@/lib/hub/http';
import { listChannelsFor, listFeed } from '@/lib/hub/repository';

/** Feed da nova Home: publicações vivas + canais da pessoa. O ranking é feito no cliente. */
export const GET = hubRoute('feed:list', async ({ viewer }) => {
  const [posts, channels] = await Promise.all([listFeed(viewer), listChannelsFor(viewer)]);
  return jsonOk({ posts, channels, viewer: { email: viewer.email, name: viewer.name, isContentManager: viewer.isContentManager } });
});

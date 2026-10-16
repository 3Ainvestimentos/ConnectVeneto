import { hubRoute, jsonOk } from '@/lib/hub/http';
import { getDigestLastSeen, listChannelsFor, listFeed } from '@/lib/hub/repository';

/**
 * Feed da nova Home: publicações vivas + canais da pessoa. O ranking é feito no cliente.
 * `digestSeenAt` permite marcar nos canais o que chegou depois do último Resumo diário.
 */
export const GET = hubRoute('feed:list', async ({ viewer }) => {
  const [posts, channels, digestSeenAt] = await Promise.all([listFeed(viewer), listChannelsFor(viewer), getDigestLastSeen(viewer.email)]);
  return jsonOk({
    posts,
    channels,
    digestSeenAt,
    viewer: { email: viewer.email, name: viewer.name, isContentManager: viewer.isContentManager },
  });
});

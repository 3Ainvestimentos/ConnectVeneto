import { hubRoute, jsonOk } from '@/lib/hub/http';
import { markDigestSeen } from '@/lib/hub/repository';

/** A pessoa fechou o resumo: o próximo começa a partir de agora. */
export const POST = hubRoute('digest:seen', async ({ viewer }) => {
  return jsonOk({ lastSeenAt: await markDigestSeen(viewer.email) });
});

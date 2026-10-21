import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { hubRoute, jsonOk } from '@/lib/hub/http';
import type { HubVacationItem } from '@/lib/hub/people';
import { VACATION_REQUESTS_COLLECTION } from '@/types/vacation';

const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 120;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Férias aprovadas de todo mundo numa janela (padrão: de hoje até 60 dias), para a Home e os Perfis.
 * Lê pelo servidor porque o registro oficial (`vacations`) só é legível pelo dono e pelo super
 * admin; junta as solicitações aprovadas que ainda não viraram registro. Só nome e datas saem daqui.
 */
export const GET = hubRoute('vacations:list', async ({ request }) => {
  const days = Math.min(MAX_DAYS, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 60));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = iso(today);
  const to = iso(new Date(today.getTime() + days * DAY));

  const db = getFirestore(getFirebaseAdminApp());
  // Filtro de data em memória: as duas coleções são pequenas e assim não exige índice composto.
  const [official, requests] = await Promise.all([
    db.collection('vacations').get(),
    db.collection(VACATION_REQUESTS_COLLECTION).where('status', '==', 'approved').get(),
  ]);

  const items = new Map<string, HubVacationItem>();
  for (const d of official.docs) {
    const v = d.data();
    items.set(String(v.sourceRequestId || d.id), { id: d.id, uid: String(v.collaboratorUid ?? ''), name: String(v.collaboratorName ?? ''), startDate: String(v.startDate ?? ''), endDate: String(v.endDate ?? '') });
  }
  for (const d of requests.docs) {
    if (items.has(d.id)) continue;
    const r = d.data();
    items.set(d.id, { id: d.id, uid: String(r.requesterUid ?? ''), name: String(r.requesterName ?? ''), startDate: String(r.startDate ?? ''), endDate: String(r.endDate ?? '') });
  }

  const vacations = [...items.values()]
    .filter((v) => v.startDate && v.endDate && v.endDate >= from && v.startDate <= to)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return jsonOk({ vacations });
});

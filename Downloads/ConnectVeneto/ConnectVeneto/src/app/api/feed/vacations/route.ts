import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { hubRoute, jsonOk } from '@/lib/hub/http';
import type { HubVacationItem } from '@/lib/hub/people';
import { VACATION_REQUESTS_COLLECTION } from '@/types/vacation';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Férias aprovadas de todo mundo que ainda não terminaram (em andamento ou futuras, sem limite de
 * data), para a Home e os Perfis. Lê pelo servidor porque o registro oficial (`vacations`) só é
 * legível pelo dono e pelo super admin; junta as solicitações aprovadas que ainda não viraram
 * registro e as férias informadas só para exibição no Hub (`hubVacations`, fora do saldo de
 * férias). Só nome e datas saem daqui.
 */
export const GET = hubRoute('vacations:list', async () => {
  const from = iso(new Date());

  const db = getFirestore(getFirebaseAdminApp());
  // Filtro de data em memória: as duas coleções são pequenas e assim não exige índice composto.
  const [official, requests, hubOnly] = await Promise.all([
    db.collection('vacations').get(),
    db.collection(VACATION_REQUESTS_COLLECTION).where('status', '==', 'approved').get(),
    db.collection('hubVacations').get(),
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

  for (const d of hubOnly.docs) {
    const h = d.data();
    // Mesmo período já registrado oficialmente para a pessoa: fica o oficial.
    const dup = [...items.values()].some((v) => v.uid === h.uid && v.startDate === h.startDate);
    if (!dup) items.set(`hub-${d.id}`, { id: d.id, uid: String(h.uid ?? ''), name: String(h.name ?? ''), startDate: String(h.startDate ?? ''), endDate: String(h.endDate ?? '') });
  }

  const vacations = [...items.values()]
    .filter((v) => v.startDate && v.endDate && v.endDate >= from)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return jsonOk({ vacations });
});

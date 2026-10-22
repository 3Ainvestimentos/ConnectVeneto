import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { UNIT_TYPES, type OrgUnit } from './org-units';

/** Coleção da estrutura (ADR 0004). Fechada ao navegador; leitura e escrita pelas rotas do servidor. */
export const ORG_UNITS_COLLECTION = 'orgUnits';

export async function readOrgUnits(): Promise<OrgUnit[]> {
  const snap = await getFirestore(getFirebaseAdminApp()).collection(ORG_UNITS_COLLECTION).get();
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      name: String(v.name ?? ''),
      type: (UNIT_TYPES as readonly string[]).includes(v.type) ? v.type : 'equipe',
      parentId: v.parentId ? String(v.parentId) : null,
      leaderIdVeneto: v.leaderIdVeneto ? String(v.leaderIdVeneto) : null,
      accessProfileId: v.accessProfileId ? String(v.accessProfileId) : null,
    };
  });
}

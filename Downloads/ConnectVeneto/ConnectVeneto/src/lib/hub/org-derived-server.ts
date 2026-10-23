import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { computeOrgDerivedUpdates, type OrgDerivedUpdate } from './org-derived';
import { readOrgUnits } from './org-units-server';
import type { CollaboratorLike } from './people';

const LOG_COLLECTION = 'collaborator_logs';
/** Cada pessoa alterada = 2 escritas (doc + log); o lote do Firestore aceita 500. */
const PEOPLE_PER_BATCH = 200;

/**
 * Regrava `area`, `team` e `leader` de quem está numa unidade a partir da estrutura (ver
 * `org-derived.ts`). Só escreve o que mudou, com log por pessoa, e sobe a versão da tabela de
 * colaboradores. `only` limita a pessoas (ids); `dryRun` só calcula.
 */
export async function syncOrgDerivedFields(opts: { by: string; only?: string[]; dryRun?: boolean }): Promise<OrgDerivedUpdate[]> {
  const db = getFirestore(getFirebaseAdminApp());
  const [snap, units] = await Promise.all([db.collection('collaborators').get(), readOrgUnits()]);
  const collaborators = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CollaboratorLike);
  const updates = computeOrgDerivedUpdates(collaborators, units, opts.only);
  if (opts.dryRun || updates.length === 0) return updates;

  const now = new Date().toISOString();
  for (let i = 0; i < updates.length; i += PEOPLE_PER_BATCH) {
    const batch = db.batch();
    for (const { id, name, changes } of updates.slice(i, i + PEOPLE_PER_BATCH)) {
      batch.update(db.collection('collaborators').doc(id), Object.fromEntries(changes.map((c) => [c.field, c.newValue])));
      batch.create(db.collection(LOG_COLLECTION).doc(), {
        collaboratorId: id,
        collaboratorName: name,
        updatedBy: opts.by,
        updatedAt: now,
        source: 'org-derived',
        changes,
      });
    }
    await batch.commit();
  }
  await db.collection('systemSettings').doc('config').update({ collaboratorTableVersion: FieldValue.increment(1) });
  return updates;
}

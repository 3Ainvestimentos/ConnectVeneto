import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { isSuperAdminAddress, logSecurityEvent, requireCollaboratorAdmin, securityErrorResponse } from '@/lib/security';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

const COLLECTION_NAME = 'collaborators';
const LOG_COLLECTION_NAME = 'collaborator_logs';
const MAX_ROWS = 1000;
/** Cada colaborador alterado gera 2 escritas (doc + log); o lote do Firestore aceita 500. */
const ROWS_PER_BATCH = 200;

const isoOrEmpty = z.string().trim().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data inválida.');

const bodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    rows: z
      .array(
        z
          .object({
            idVeneto: z.string().trim().min(1).max(60),
            birthDate: isoOrEmpty.optional(),
            admissionDate: isoOrEmpty.optional(),
            team: z.string().trim().max(120).optional(),
            leaderIdVeneto: z.string().trim().max(60).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_ROWS),
  })
  .strict();

type Change = { field: string; oldValue: unknown; newValue: unknown };

/**
 * Atualiza, em lote, os dados do Perfil que o RH mantém (nascimento, entrada, equipe e gestor)
 * em colaboradores que já existem, achados pelo ID Veneto. Não cria ninguém: quem não existe
 * volta em `notFound`. `dryRun` devolve o que mudaria sem gravar (a tela mostra a prévia).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCollaboratorAdmin(request.headers.get('Authorization'));
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requisição inválida.' }, { status: 400 });
    }
    const { rows, dryRun = false } = parsed.data;

    const db = getFirestore(getFirebaseAdminApp());
    const snap = await db.collection(COLLECTION_NAME).get();
    const byIdVeneto = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const d of snap.docs) {
      const idVeneto = String(d.get('idVeneto') ?? '').trim();
      if (idVeneto) byIdVeneto.set(idVeneto, d);
    }

    const notFound: string[] = [];
    const unknownManager: string[] = [];
    const protectedSkipped: string[] = [];
    const updates: { doc: FirebaseFirestore.QueryDocumentSnapshot; changes: Change[] }[] = [];

    for (const row of rows) {
      const doc = byIdVeneto.get(row.idVeneto);
      if (!doc) {
        notFound.push(row.idVeneto);
        continue;
      }
      if (row.leaderIdVeneto && !byIdVeneto.has(row.leaderIdVeneto)) {
        unknownManager.push(row.idVeneto);
        continue;
      }
      const prev = doc.data();
      const next: Record<string, unknown> = {};
      if (row.birthDate !== undefined) next.birthDate = row.birthDate;
      if (row.admissionDate !== undefined) next.admissionDate = row.admissionDate;
      if (row.team !== undefined) next.team = row.team;
      if (row.leaderIdVeneto !== undefined) {
        next.leaderIdVeneto = row.leaderIdVeneto;
        // O nome legado acompanha o gestor (outras telas ainda leem `leader`).
        const manager = row.leaderIdVeneto ? byIdVeneto.get(row.leaderIdVeneto) : undefined;
        if (manager) next.leader = manager.get('name');
      }
      const changes = Object.entries(next)
        .filter(([field, value]) => (prev[field] ?? '') !== value)
        .map(([field, newValue]) => ({ field, oldValue: prev[field] ?? null, newValue }));
      if (changes.length === 0) continue;
      if (!auth.isSuperAdmin && (await isSuperAdminAddress(prev.email))) {
        protectedSkipped.push(row.idVeneto);
        continue;
      }
      updates.push({ doc, changes });
    }

    if (!dryRun) {
      const now = new Date().toISOString();
      for (let i = 0; i < updates.length; i += ROWS_PER_BATCH) {
        const batch = db.batch();
        for (const { doc, changes } of updates.slice(i, i + ROWS_PER_BATCH)) {
          batch.update(doc.ref, Object.fromEntries(changes.map((c) => [c.field, c.newValue])));
          batch.create(db.collection(LOG_COLLECTION_NAME).doc(), {
            collaboratorId: doc.id,
            collaboratorName: doc.get('name') ?? '',
            updatedBy: auth.email ?? 'desconhecido',
            updatedAt: now,
            source: 'profile-import',
            changes,
          });
        }
        await batch.commit();
      }
      logSecurityEvent('[api/admin/collaborators/profile-import] perfis atualizados', {
        email: auth.email,
        updated: updates.length,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        dryRun,
        updated: updates.length,
        unchanged: rows.length - updates.length - notFound.length - unknownManager.length - protectedSkipped.length,
        notFound,
        unknownManager,
        protectedSkipped,
        preview: updates.slice(0, 20).map(({ doc, changes }) => ({ name: doc.get('name'), changes })),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const known = securityErrorResponse(error);
    if (known) return known;
    logSecurityEvent('[api/admin/collaborators/profile-import] falha', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Não foi possível atualizar os perfis.' }, { status: 500 });
  }
}

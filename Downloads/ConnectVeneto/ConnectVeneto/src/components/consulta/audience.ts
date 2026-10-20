import type { Collaborator } from '@/contexts/CollaboratorsContext';
import { isBlankLabel, normalizeLabel, type AudienceMember } from '@/config/consulta-links';

/** `team` vem do Organograma e ainda não está no tipo `Collaborator`. */
type CollaboratorWithTeam = Collaborator & { team?: string };

export const toAudienceMember = (collaborator: Collaborator): AudienceMember => ({
  email: collaborator.email.toLowerCase(),
  area: collaborator.area,
  team: (collaborator as CollaboratorWithTeam).team ?? null,
});

/** Valores distintos de um campo do cadastro, sem "—"/vazios, agrupando grafias com/sem acento. */
export function distinctLabels(collaborators: Collaborator[], pick: (c: CollaboratorWithTeam) => string | undefined) {
  const byKey = new Map<string, { label: string; count: number }>();
  for (const collaborator of collaborators) {
    const value = pick(collaborator)?.trim();
    if (!value || isBlankLabel(value)) continue;
    const key = normalizeLabel(value);
    const current = byKey.get(key);
    byKey.set(key, { label: current?.label ?? value, count: (current?.count ?? 0) + 1 });
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Colaboradores com e-mail, no formato do seletor de pessoas. */
export const toPickablePeople = (collaborators: Collaborator[]) =>
  collaborators
    .filter((c) => c.email)
    .map((c) => ({ email: c.email.toLowerCase(), name: c.name, area: isBlankLabel(c.area) ? '' : c.area }));

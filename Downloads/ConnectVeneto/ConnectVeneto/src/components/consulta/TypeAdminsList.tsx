"use client";

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { isTypeAdmin, type ConsultaLinkType } from '@/config/consulta-links';
import { toAudienceMember } from './audience';

/**
 * Quem administra o tipo hoje: as pessoas das áreas administradoras (pelo cadastro
 * atual) e os e-mails avulsos. Super admins não entram — administram todos os tipos.
 */
export function TypeAdminsList({
  type,
  emptyText = 'Nenhum administrador além dos super admins.',
}: {
  type: Pick<ConsultaLinkType, 'adminEmails' | 'adminAreas'>;
  emptyText?: string;
}) {
  const { collaborators } = useCollaborators();

  const admins = useMemo(
    () =>
      collaborators
        .filter((c) => c.email && isTypeAdmin(type, toAudienceMember(c)))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [collaborators, type]
  );

  if (admins.length === 0) return <p className="text-xs text-muted-foreground">{emptyText}</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {admins.map((admin) => (
        <Badge key={admin.id} variant="secondary" className="font-normal" title={[admin.position, admin.area, admin.email].filter(Boolean).join(' · ')}>
          {admin.name}
        </Badge>
      ))}
    </div>
  );
}

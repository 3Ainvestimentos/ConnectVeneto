"use client";

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { isInAudience, type Audience } from '@/config/consulta-links';
import { distinctLabels, toAudienceMember, toPickablePeople } from './audience';
import { PersonCombobox } from './PersonCombobox';

type AudiencePickerProps = {
  value: Audience;
  onChange: (audience: Audience) => void;
};

export function LabelChecklist({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { label: string; count: number }[];
  selected: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <ScrollArea className="h-36 rounded-md border">
        <div className="grid gap-1 p-2 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.label} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
              <Checkbox checked={selected.includes(option.label)} onCheckedChange={() => onToggle(option.label)} />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.count}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Com quem um link é compartilhado. Área e equipe valem pelo cadastro atual: quem
 * entra depois já recebe o link, quem sai deixa de ver.
 */
export function AudiencePicker({ value, onChange }: AudiencePickerProps) {
  const { collaborators } = useCollaborators();

  const areas = useMemo(() => distinctLabels(collaborators, (c) => c.area), [collaborators]);
  const teams = useMemo(() => distinctLabels(collaborators, (c) => c.team), [collaborators]);
  const nameByEmail = useMemo(
    () => new Map(collaborators.map((c) => [c.email.toLowerCase(), c.name] as const)),
    [collaborators]
  );
  const pickable = useMemo(() => toPickablePeople(collaborators), [collaborators]);
  const reach = useMemo(
    () => collaborators.filter((c) => c.email && isInAudience(value, toAudienceMember(c))).length,
    [collaborators, value]
  );

  const toggle = (field: 'areas' | 'teams', label: string) =>
    onChange({
      ...value,
      [field]: value[field].includes(label) ? value[field].filter((item) => item !== label) : [...value[field], label],
    });

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox checked={value.everyone} onCheckedChange={(checked) => onChange({ ...value, everyone: checked === true })} />
          Empresa toda
        </label>
        <span className="text-xs text-muted-foreground">Hoje: {reach} {reach === 1 ? 'pessoa' : 'pessoas'}</span>
      </div>

      {!value.everyone && (
        <>
          <LabelChecklist title="Áreas" options={areas} selected={value.areas} onToggle={(label) => toggle('areas', label)} />

          {teams.length > 0 && (
            <LabelChecklist title="Equipes" options={teams} selected={value.teams} onToggle={(label) => toggle('teams', label)} />
          )}

          <div className="space-y-2">
            <Label>Pessoas</Label>
            <PersonCombobox
              people={pickable}
              exclude={new Set(value.emails)}
              onSelect={(person) => person && onChange({ ...value, emails: [...value.emails, person.email] })}
              aria-label="Adicionar pessoa ao público"
            />
            {value.emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {value.emails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    {nameByEmail.get(email) ?? email}
                    <button
                      type="button"
                      aria-label={`Remover ${nameByEmail.get(email) ?? email}`}
                      onClick={() => onChange({ ...value, emails: value.emails.filter((item) => item !== email) })}
                      className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

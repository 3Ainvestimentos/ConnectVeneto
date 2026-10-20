"use client";

import React, { useMemo, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { normalizeLabel } from '@/config/consulta-links';
import { cn } from '@/lib/utils';

export type PickablePerson = { email: string; name: string; area: string };

const MAX_RESULTS = 8;

type PersonComboboxProps = {
  people: PickablePerson[];
  /** E-mails que não podem ser escolhidos de novo (já estão na lista). */
  exclude?: Set<string>;
  /** Pessoa escolhida — mostrada no campo até a próxima digitação. */
  selected?: PickablePerson | null;
  onSelect: (person: PickablePerson | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

/**
 * Busca de colaborador por nome, e-mail ou área, no visual do app (a `<datalist>`
 * nativa segue o tema do sistema operacional e não o do app).
 */
export function PersonCombobox({
  people,
  exclude,
  selected,
  onSelect,
  placeholder = 'Digite o nome ou e-mail',
  className,
  disabled,
  'aria-label': ariaLabel,
}: PersonComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = React.useId();

  const results = useMemo(() => {
    const term = normalizeLabel(query);
    return people
      .filter((person) => !exclude?.has(person.email))
      .filter((person) => !term || normalizeLabel(`${person.name} ${person.email} ${person.area}`).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, MAX_RESULTS);
  }, [people, exclude, query]);

  const choose = (person: PickablePerson) => {
    onSelect(person);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (results.length ? (index + step + results.length) % results.length : 0));
    } else if (event.key === 'Enter' && open && results[active]) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <PopoverPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn('relative', className)}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={selected && !query ? selected.name : query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
              if (selected) onSelect(null);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-9 pl-8"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            autoComplete="off"
            disabled={disabled}
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // Clicar no próprio campo não fecha a lista.
            if ((event.target as HTMLElement).closest?.('[role="combobox"]')) event.preventDefault();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[16rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">Ninguém encontrado.</li>
            ) : (
              results.map((person, index) => (
                <li
                  key={person.email}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(person)}
                  className={cn(
                    'flex cursor-pointer flex-col rounded-sm px-2 py-1.5 text-sm',
                    index === active && 'bg-accent text-accent-foreground'
                  )}
                >
                  <span className="truncate font-medium">{person.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[person.area, person.email].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

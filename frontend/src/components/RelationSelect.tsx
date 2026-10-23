import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useList, useOne, Params } from '@/lib/queries';
import { Spinner } from './ui';

export interface Relation {
  path: string;
  label: (o: any) => string;
  params?: Params;
  searchable?: boolean;
}

export function RelationSelect({
  value,
  onChange,
  relation,
  disabled,
  placeholder = 'Sélectionner…',
}: {
  value: number | string | null | undefined;
  onChange: (v: number | null) => void;
  relation: Relation;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const list = useList<any>(relation.path, { page_size: 20, ...relation.params, search: dq }, open);
  const current = useOne<any>(relation.path, value ?? undefined, !!value);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? 'truncate' : 'truncate text-mute'}>
          {value ? (current.data ? relation.label(current.data) : 'Chargement…') : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {value && !disabled ? (
            <X
              className="h-4 w-4 text-mute hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : null}
          <ChevronDown className="h-4 w-4 text-mute" />
        </span>
      </button>
      {open && (
        <div className="card absolute z-30 mt-1 w-full overflow-hidden p-1.5">
          <input
            autoFocus
            className="input mb-1.5 h-9"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul role="listbox" className="max-h-56 overflow-y-auto">
            {list.isFetching && !list.data && (
              <li className="flex justify-center p-3">
                <Spinner />
              </li>
            )}
            {list.data?.results.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-sunken"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  {relation.label(o)}
                </button>
              </li>
            ))}
            {list.data && !list.data.results.length && (
              <li className="p-3 text-center text-sm text-mute">Aucun résultat</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  DEGREE_LEVEL_OPTIONS,
  degreeDisplayLabel,
  degreeLevelLabel,
  isDegreeLevel,
  parseDegree,
  stripFieldFromDegreeTitle,
  type DegreeLevel,
} from '@/lib/degreeNormalization';

type Props = {
  id?: string;
  degreeLevel: DegreeLevel | '';
  degreeTitle: string;
  fieldOfStudy?: string;
  onChange: (patch: { degreeLevel: DegreeLevel | ''; degreeTitle: string }) => void;
  className?: string;
};

export function DegreeCombobox({
  id,
  degreeLevel,
  degreeTitle,
  fieldOfStudy = '',
  onChange,
  className = 'onboarding-input-sm',
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayValue = useMemo(
    () => degreeDisplayLabel(degreeLevel, degreeTitle, fieldOfStudy),
    [degreeLevel, degreeTitle, fieldOfStudy],
  );

  useEffect(() => {
    if (!open) setQuery(displayValue);
  }, [displayValue, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEGREE_LEVEL_OPTIONS;
    return DEGREE_LEVEL_OPTIONS.filter(
      o => o.label.toLowerCase().includes(q) || o.value.includes(q),
    );
  }, [query]);

  function selectLevel(level: DegreeLevel, label: string) {
    onChange({ degreeLevel: level, degreeTitle: label });
    setQuery(label);
    setOpen(false);
  }

  function commitFreeText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange({ degreeLevel: '', degreeTitle: '' });
      return;
    }
    if (isDegreeLevel(trimmed)) {
      selectLevel(trimmed, degreeLevelLabel(trimmed));
      return;
    }
    const parsed = parseDegree(trimmed);
    const field = fieldOfStudy.trim();
    const title = field ? stripFieldFromDegreeTitle(parsed.title, field) : parsed.title;
    onChange({ degreeLevel: parsed.level, degreeTitle: title });
  }

  return (
    <div className="onboarding-combobox" ref={rootRef}>
      <input
        id={id}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={open ? query : displayValue}
        placeholder="e.g. B.Tech, MSc, Bachelor's"
        onFocus={() => {
          setOpen(true);
          setQuery(displayValue);
        }}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              commitFreeText(query);
              setOpen(false);
            }
          }, 120);
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') {
            e.preventDefault();
            commitFreeText(query);
            setOpen(false);
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul id={listId} className="onboarding-combobox__list" role="listbox">
          {filtered.map(opt => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                className="onboarding-combobox__option"
                aria-selected={degreeLevel === opt.value}
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectLevel(opt.value, opt.label)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

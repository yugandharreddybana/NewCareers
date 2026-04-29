import { KeyboardEvent, useState } from 'react';

export default function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft('');
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  }
  return (
    <div className="input flex flex-wrap gap-1.5 min-h-[42px] py-1.5">
      {value.map(t => (
        <span key={t} className="chip-slate">
          {t}
          <button type="button" className="ml-1 text-slate-400 hover:text-rose-500" onClick={() => onChange(value.filter(x => x !== t))}>×</button>
        </span>
      ))}
      <input
        className="flex-1 outline-none bg-transparent text-sm min-w-[120px]"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={placeholder || 'Type and press Enter…'}
      />
    </div>
  );
}

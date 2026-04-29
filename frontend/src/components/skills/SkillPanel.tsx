import { ReactNode } from 'react';

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Slide-in side panel for skill results */
export default function SkillPanel({ title, open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 w-full sm:w-[560px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-ink-900 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 text-sm">
          {children}
        </div>
      </aside>
    </>
  );
}

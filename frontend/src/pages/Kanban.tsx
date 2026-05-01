import { useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jobsApi, kanbanApi } from '@/services/api';
import { JobCard, KANBAN_COLUMNS, KanbanColumn } from '@/types';
import AppliedCvModal from '@/components/kanban/AppliedCvModal';
import {
  Banknote, ShieldCheck, Loader2, Kanban as KanbanIcon,
  GripVertical, LayoutGrid, List, MapPin, ExternalLink,
  Building2,
} from 'lucide-react';

interface ModalState { userJobId: string; jobTitle: string }

// ── Per-column visual config ───────────────────────────────────────────────────
const COL_META: Record<KanbanColumn, {
  dot:          string;
  badge:        string;
  headerBorder: string;
  dropActive:   string;
}> = {
  Discovered: {
    dot:          'bg-blue-400',
    badge:        'bg-blue-50 text-blue-700 border-blue-200',
    headerBorder: 'border-l-blue-400',
    dropActive:   'bg-blue-50/60 border-blue-300',
  },
  Saved: {
    dot:          'bg-indigo-400',
    badge:        'bg-indigo-50 text-indigo-700 border-indigo-200',
    headerBorder: 'border-l-indigo-400',
    dropActive:   'bg-indigo-50/60 border-indigo-300',
  },
  Applied: {
    dot:          'bg-amber-400',
    badge:        'bg-amber-50 text-amber-700 border-amber-200',
    headerBorder: 'border-l-amber-400',
    dropActive:   'bg-amber-50/60 border-amber-300',
  },
  Interview: {
    dot:          'bg-violet-400',
    badge:        'bg-violet-50 text-violet-700 border-violet-200',
    headerBorder: 'border-l-violet-400',
    dropActive:   'bg-violet-50/60 border-violet-300',
  },
  Offer: {
    dot:          'bg-emerald-400',
    badge:        'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBorder: 'border-l-emerald-400',
    dropActive:   'bg-emerald-50/60 border-emerald-300',
  },
  Rejected: {
    dot:          'bg-red-400',
    badge:        'bg-red-50 text-red-700 border-red-200',
    headerBorder: 'border-l-red-400',
    dropActive:   'bg-red-50/60 border-red-300',
  },
};

// ── Company avatar helpers ──────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700', 'bg-indigo-100 text-indigo-700',
];
function companyInitials(c: string) {
  return c.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}
function avatarColor(c: string) {
  let h = 0;
  for (let i = 0; i < c.length; i++) h = c.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Source badge ────────────────────────────────────────────────────────────
const SOURCE_STYLES: Record<string, string> = {
  'LinkedIn (Twin AI)': 'bg-blue-50 text-blue-700 border-blue-200',
  'IrishJobs':          'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Reed':               'bg-red-50 text-red-700 border-red-200',
  'Adzuna':             'bg-orange-50 text-orange-700 border-orange-200',
  'Remotive':           'bg-purple-50 text-purple-700 border-purple-200',
};
function getSourceStyle(s?: string) {
  if (!s) return 'bg-slate-50 text-slate-500 border-slate-200';
  const k = Object.keys(SOURCE_STYLES).find(k => s.toLowerCase().includes(k.toLowerCase()));
  return k ? SOURCE_STYLES[k] : 'bg-slate-50 text-slate-500 border-slate-200';
}
function sourceLabel(s?: string) {
  return s ? s.replace(/ Careers$/i, '').trim() : 'Job Board';
}

// ── Match colour helpers ────────────────────────────────────────────────
function matchBadge(pct: number) {
  if (pct >= 75) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (pct >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-500 bg-red-50 border-red-200';
}
function matchBar(pct: number) {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}
function matchText(pct: number) {
  if (pct >= 75) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-500';
}

// ─────────────────────────────────────────────────────────────────────────────
export default function KanbanPage() {
  const [cards,      setCards]      = useState<JobCard[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState<ModalState | null>(null);
  const [cardMode,   setCardMode]   = useState<'compact' | 'full'>('compact');
  const [activeCol,  setActiveCol]  = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await jobsApi.list();
      setCards(res.items || []);
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Track horizontal scroll for mobile indicator dots
  const handleBoardScroll = () => {
    if (!boardRef.current) return;
    const { scrollLeft } = boardRef.current;
    const colWidth = 288 + 16; // w-72 (288px) + gap-4 (16px)
    setActiveCol(Math.round(scrollLeft / colWidth));
  };

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newCol = destination.droppableId as KanbanColumn;

    setCards(prev => prev.map(c =>
      c.userJobId === draggableId ? { ...c, kanbanColumn: newCol } : c
    ));

    try {
      await kanbanApi.patch(draggableId, { kanbanColumn: newCol, status: newCol.toLowerCase() });
      if (newCol === 'Applied') {
        const card = cards.find(c => c.userJobId === draggableId);
        if (card) setModal({ userJobId: draggableId, jobTitle: card.title });
      }
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Update failed');
      load();
    }
  }

  const byColumn = (col: KanbanColumn) => cards.filter(c => c.kanbanColumn === col);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="text-emerald-500 animate-spin" />
        <p className="text-slate-500 text-sm font-medium">Loading your pipeline…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <KanbanIcon size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Career Pipeline</h1>
            <p className="text-sm text-slate-400 font-medium">Drag cards to track your progress</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCardMode(m => m === 'compact' ? 'full' : 'compact')}
            title={cardMode === 'compact' ? 'Switch to full view' : 'Switch to compact view'}
            className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all"
          >
            {cardMode === 'compact'
              ? <><LayoutGrid size={14} /> Full view</>
              : <><List size={14} /> Compact</>
            }
          </button>

          <div className="hidden sm:flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
            <span className="text-sm font-black text-slate-900">{cards.length}</span>
            <span className="text-sm text-slate-400">jobs tracked</span>
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          ref={boardRef}
          onScroll={handleBoardScroll}
          className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
        >
          {KANBAN_COLUMNS.map(col => {
            const meta     = COL_META[col];
            const colCards = byColumn(col);
            return (
              <div key={col} className="shrink-0 w-72 flex flex-col snap-start">

                {/* Column header */}
                <div className={`bg-white border border-slate-200 border-l-4 ${meta.headerBorder} rounded-xl px-4 py-3 mb-3 flex items-center justify-between shadow-sm`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className="text-sm font-bold text-slate-700">{col}</span>
                  </div>
                  {/* ✓ column count badge visible (task 135) */}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                    {colCards.length}
                  </span>
                </div>

                {/* Drop zone — independent scroll */}
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={[
                        'flex flex-col gap-2.5 min-h-[400px] max-h-[calc(100vh-280px)] overflow-y-auto',
                        'p-2.5 rounded-xl border-2 border-dashed transition-all duration-200',
                        snapshot.isDraggingOver
                          ? meta.dropActive
                          : 'bg-slate-50/50 border-slate-200',
                      ].join(' ')}
                    >
                      {colCards.map((card, index) => (
                        <Draggable key={card.userJobId} draggableId={card.userJobId} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={[
                                'bg-white border border-slate-200 rounded-xl p-3.5',
                                'cursor-grab active:cursor-grabbing transition-all duration-150',
                                snap.isDragging
                                  ? 'shadow-xl ring-2 ring-emerald-400/30 rotate-1 scale-[1.02]'
                                  : 'hover:border-slate-300 hover:shadow-sm',
                              ].join(' ')}
                            >
                              {/*
                                Mobile fix (task 135): drag handle wrapper raised to
                                min 44px touch target — spread dragHandleProps on a
                                dedicated 44×44 wrapper div instead of the card itself
                                so touch targets meet WCAG 2.5.5.
                              */}
                              <div
                                {...prov.dragHandleProps}
                                className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100"
                                aria-label="Drag to reorder"
                              />
                              {cardMode === 'full'
                                ? <FullKanbanCard card={card} />
                                : <CompactKanbanCard card={card} />
                              }
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {colCards.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex-1 flex items-center justify-center py-10">
                          <p className="text-xs text-slate-300 font-medium">Drop here</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* ── Mobile scroll indicator dots ──
           ✓ horizontal scroll + snap + dots indicator (task 135)
      */}
      <div className="flex items-center gap-2 justify-center md:hidden pb-2">
        {KANBAN_COLUMNS.map((col, i) => (
          <button
            key={col}
            aria-label={`Scroll to ${col} column`}
            onClick={() => {
              boardRef.current?.scrollTo({
                left: i * (288 + 16),
                behavior: 'smooth',
              });
            }}
            className={[
              'rounded-full transition-all duration-200',
              i === activeCol
                ? 'w-5 h-1.5 bg-emerald-500'
                : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Applied CV modal */}
      {modal && (
        <AppliedCvModal
          userJobId={modal.userJobId}
          jobTitle={modal.jobTitle}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── COMPACT card ─────────────────────────────────────────────────────────────────────
function CompactKanbanCard({ card }: { card: JobCard }) {
  const salary = card.salaryMin && card.salaryMax
    ? `€${(card.salaryMin / 1000).toFixed(0)}k–€${(card.salaryMax / 1000).toFixed(0)}k`
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link
            to={`/jobs/${card.userJobId}`}
            onClick={e => e.stopPropagation()}
            className="text-sm font-bold text-slate-800 hover:text-emerald-700 transition-colors block leading-snug truncate"
          >
            {card.title}
          </Link>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{card.company}</p>
        </div>
        {/* ✓ GripVertical wrapped in 44px touch area for mobile (task 135) */}
        <div className="w-11 h-11 flex items-center justify-center shrink-0 -mr-1.5 -mt-1.5">
          <GripVertical size={14} className="text-slate-300" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {card.matchPercent != null && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${matchBadge(card.matchPercent)}`}>
            {card.matchPercent}% match
          </span>
        )}
        {salary && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            <Banknote size={9} />{salary}
          </span>
        )}
        {card.sponsorship && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <ShieldCheck size={9} />Visa OK
          </span>
        )}
      </div>
    </div>
  );
}

// ── FULL card ─────────────────────────────────────────────────────────────────────────────
function FullKanbanCard({ card }: { card: JobCard }) {
  const salary = card.salaryMin && card.salaryMax
    ? `€${(card.salaryMin / 1000).toFixed(0)}k – €${(card.salaryMax / 1000).toFixed(0)}k`
    : card.salaryMin ? `€${(card.salaryMin / 1000).toFixed(0)}k+`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(card.company)}`}>
          {companyInitials(card.company) || <Building2 size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            to={`/jobs/${card.userJobId}`}
            onClick={e => e.stopPropagation()}
            className="text-sm font-bold text-slate-800 hover:text-emerald-700 transition-colors block leading-snug truncate"
          >
            {card.title}
          </Link>
          <p className="text-[11px] text-slate-500 font-medium truncate">{card.company}</p>
        </div>
        {/* ✓ 44px touch target for drag handle */}
        <div className="w-11 h-11 flex items-center justify-center shrink-0 -mr-1.5 -mt-1.5">
          <GripVertical size={14} className="text-slate-300" />
        </div>
      </div>

      {card.matchPercent != null && (
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400 font-medium">Match</span>
            <span className={`font-bold ${matchText(card.matchPercent)}`}>{card.matchPercent}%</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${matchBar(card.matchPercent)}`}
              style={{ width: `${card.matchPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {card.location && (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            <MapPin size={8} />{card.location}
          </span>
        )}
        {salary && (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            <Banknote size={8} />{salary}
          </span>
        )}
        {card.sourceName && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSourceStyle(card.sourceName)}`}>
            <ExternalLink size={8} />{sourceLabel(card.sourceName)}
          </span>
        )}
        {card.sponsorship && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <ShieldCheck size={8} />Visa OK
          </span>
        )}
      </div>
    </div>
  );
}

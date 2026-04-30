import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jobsApi, kanbanApi } from '@/services/api';
import { JobCard, KANBAN_COLUMNS, KanbanColumn } from '@/types';
import AppliedCvModal from '@/components/kanban/AppliedCvModal';
import { Banknote, ShieldCheck, Loader2, Kanban as KanbanIcon, GripVertical } from 'lucide-react';

interface ModalState { userJobId: string; jobTitle: string }

// ── Per-column visual config ─────────────────────────────────────────
const COL_META: Record<KanbanColumn, {
  dot:        string;
  badge:      string;
  headerBorder: string;
  dropActive: string;
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

export default function KanbanPage() {
  const [cards,   setCards]   = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<ModalState | null>(null);

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

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newCol = destination.droppableId as KanbanColumn;

    // Optimistic update
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
      load(); // revert
    }
  }

  const byColumn = (col: KanbanColumn) => cards.filter(c => c.kanbanColumn === col);

  // ── Loading state ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="text-emerald-500 animate-spin" />
        <p className="text-slate-500 text-sm font-medium">Loading your pipeline…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <KanbanIcon size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Career Pipeline</h1>
            <p className="text-sm text-slate-400 font-medium">Drag cards to track your progress</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="text-sm font-black text-slate-900">{cards.length}</span>
          <span className="text-sm text-slate-400 ml-1.5">jobs tracked</span>
        </div>
      </div>

      {/* ── Mobile scroll hint ── */}
      <p className="text-xs text-slate-400 md:hidden">Swipe right to see all columns →</p>

      {/* ── Board ── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-8 snap-x snap-mandatory">
          {KANBAN_COLUMNS.map(col => {
            const meta   = COL_META[col];
            const colCards = byColumn(col);
            return (
              <div key={col} className="shrink-0 w-72 flex flex-col snap-start">

                {/* Column header */}
                <div className={`bg-white border border-slate-200 border-l-4 ${meta.headerBorder} rounded-xl px-4 py-3 mb-3 flex items-center justify-between shadow-sm`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className="text-sm font-bold text-slate-700">{col}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                    {colCards.length}
                  </span>
                </div>

                {/* Drop zone */}
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={[
                        'flex flex-col gap-3 min-h-[480px] p-2.5 rounded-xl border-2 border-dashed transition-all duration-200',
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
                              {...prov.dragHandleProps}
                              className={[
                                'bg-white border border-slate-200 rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all duration-150',
                                snap.isDragging ? 'shadow-lg ring-2 ring-emerald-400/30 rotate-1 scale-[1.01]' : 'hover:border-slate-300 hover:shadow-sm',
                              ].join(' ')}
                            >
                              <KanbanCard card={card} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {colCards.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex-1 flex items-center justify-center py-8">
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

// ── Kanban mini-card ───────────────────────────────────────────────────────────────
function KanbanCard({ card }: { card: JobCard }) {
  const salary = card.salaryMin && card.salaryMax
    ? `€${(card.salaryMin / 1000).toFixed(0)}k–€${(card.salaryMax / 1000).toFixed(0)}k`
    : null;

  const matchColor = card.matchPercent != null
    ? card.matchPercent >= 75 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : card.matchPercent >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-500 bg-red-50 border-red-200'
    : null;

  return (
    <div className="space-y-2.5">
      {/* Drag handle row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link
            to={`/jobs/${card.userJobId}`}
            className="text-sm font-bold text-slate-800 hover:text-emerald-700 transition-colors block leading-snug truncate"
            onClick={e => e.stopPropagation()}
          >
            {card.title}
          </Link>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{card.company}</p>
        </div>
        <GripVertical size={14} className="text-slate-300 shrink-0 mt-0.5" />
      </div>

      {/* Match score + badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {card.matchPercent != null && matchColor && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${matchColor}`}>
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

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jobsApi, kanbanApi } from '@/services/api';
import { JobCard, KANBAN_COLUMNS, KanbanColumn } from '@/types';
import MatchCircle from '@/components/ui/MatchCircle';
import AppliedCvModal from '@/components/kanban/AppliedCvModal';
import { motion } from 'framer-motion';
import { Building2, Banknote, ShieldCheck } from 'lucide-react';

interface ModalState { userJobId: string; jobTitle: string }

export default function KanbanPage() {
  const [cards, setCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);

  async function load() {
    try {
      const res = await jobsApi.list();
      setCards(res.items || []);
    } catch (e: any) { toast.error(e.normalizedMessage || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

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

  const byColumn = (col: KanbanColumn) =>
    cards.filter(c => c.kanbanColumn === col);

  const COLUMN_STYLES: Record<KanbanColumn, { bg: string, text: string, border: string }> = {
    Discovered: { bg: 'bg-slate-100/50', text: 'text-slate-600', border: 'border-slate-200' },
    Saved:      { bg: 'bg-blue-50/50', text: 'text-blue-600', border: 'border-blue-200' },
    Applied:    { bg: 'bg-amber-50/50', text: 'text-amber-600', border: 'border-amber-200' },
    Interview:  { bg: 'bg-violet-50/50', text: 'text-violet-600', border: 'border-violet-200' },
    Offer:      { bg: 'bg-emerald-50/50', text: 'text-emerald-600', border: 'border-emerald-200' },
    Rejected:   { bg: 'bg-rose-50/50', text: 'text-rose-600', border: 'border-rose-200' },
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-brand-vibrant/20 border-t-brand-vibrant rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Assembling your pipeline...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Career <span className="gradient-text">Pipeline</span></h1>
          <p className="text-slate-500 font-medium">Drag and drop to track your progress</p>
        </div>
        <div className="bg-white/50 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-2xl shadow-sm">
          <span className="text-sm font-bold text-brand-vibrant">{cards.length}</span>
          <span className="text-sm text-slate-400 ml-1.5 font-medium uppercase tracking-wider">Jobs Tracked</span>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
          {KANBAN_COLUMNS.map(col => (
            <div key={col} className="shrink-0 w-80 flex flex-col gap-4 snap-start">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${COLUMN_STYLES[col].bg.replace('/50', '')}`} />
                   <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">{col}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${COLUMN_STYLES[col].bg} ${COLUMN_STYLES[col].text} border ${COLUMN_STYLES[col].border}`}>
                  {byColumn(col).length}
                </span>
              </div>

              <Droppable droppableId={col}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex flex-col gap-4 min-h-[500px] p-3 rounded-2xl border-2 border-dashed transition-all duration-300
                      ${snapshot.isDraggingOver ? 'bg-brand-vibrant/5 border-brand-vibrant/30' : 'bg-slate-50/30 border-slate-200'}`}
                  >
                    {byColumn(col).map((card, index) => (
                      <Draggable key={card.userJobId} draggableId={card.userJobId} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`group transition-transform duration-200 ${snapshot.isDragging ? 'z-50' : ''}`}
                          >
                            <div className={`
                              glass-card p-4 !rounded-2xl cursor-grab active:cursor-grabbing border border-slate-100
                              ${snapshot.isDragging ? 'shadow-premium ring-2 ring-brand-vibrant/20 -rotate-1' : 'hover:border-brand-vibrant/20'}
                            `}>
                              <KanbanCard card={card} />
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

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

function KanbanCard({ card }: { card: JobCard }) {
  const salary = card.salaryMin && card.salaryMax
    ? `€${(card.salaryMin / 1000).toFixed(0)}k–€${(card.salaryMax / 1000).toFixed(0)}k`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/jobs/${card.userJobId}`}
            className="text-sm font-bold text-slate-800 hover:text-brand-vibrant transition-colors truncate block leading-tight"
            onClick={e => e.stopPropagation()}>
            {card.title}
          </Link>
          <div className="flex items-center gap-1.5 mt-1">
            <Building2 size={12} className="text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-500 truncate uppercase tracking-tighter">{card.company}</span>
          </div>
        </div>
        {card.matchPercent != null && (
          <div className="shrink-0">
            <MatchCircle percent={card.matchPercent} size={36} />
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {salary && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
            <Banknote size={10} />
            {salary}
          </div>
        )}
        {card.sponsorship && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100">
            <ShieldCheck size={10} />
            VISAS
          </div>
        )}
      </div>
    </div>
  );
}

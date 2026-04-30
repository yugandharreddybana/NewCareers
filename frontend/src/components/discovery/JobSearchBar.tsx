/**
 * Section 7 — Task 76
 * JobSearchBar
 *
 * Expandable search/filter bar for the Dashboard.
 * Collapsed state: single keyword input + "Advanced" toggle button.
 * Expanded state: keyword, location dropdown, salary range slider,
 *                 sponsorship toggle, remote toggle.
 *
 * Props:
 *   onSearch(params) — called on form submit with current SearchParams
 *   loading         — disables the submit button while a search is in flight
 */

import { useState } from 'react';
import { Search, SlidersHorizontal, X, Wifi, Stamp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchParams } from '@/services/discoveryApi';

const LOCATION_OPTIONS = [
  'All Ireland',
  'Dublin',
  'Cork',
  'Galway',
  'Limerick',
  'Remote',
];

const SALARY_MAX = 200_000;
const SALARY_STEP = 5_000;

interface Props {
  onSearch: (params: SearchParams) => void;
  loading?: boolean;
}

export default function JobSearchBar({ onSearch, loading = false }: Props) {
  const [query,       setQuery]       = useState('');
  const [location,    setLocation]    = useState('All Ireland');
  const [minSalary,   setMinSalary]   = useState(0);
  const [maxSalary,   setMaxSalary]   = useState(0);  // 0 = no cap
  const [sponsorship, setSponsorship] = useState(false);
  const [remote,      setRemote]      = useState(false);
  const [expanded,    setExpanded]    = useState(false);

  const hasAdvanced =
    location !== 'All Ireland' || minSalary > 0 ||
    maxSalary > 0 || sponsorship || remote;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params: SearchParams = {};
    if (query.trim())                  params.q           = query.trim();
    if (location !== 'All Ireland')    params.location    = location;
    if (minSalary > 0)                 params.minSalary   = minSalary;
    if (maxSalary > 0)                 params.maxSalary   = maxSalary;
    if (sponsorship)                   params.sponsorship = true;
    if (remote)                        params.remote      = true;
    onSearch(params);
  }

  function handleClear() {
    setQuery('');
    setLocation('All Ireland');
    setMinSalary(0);
    setMaxSalary(0);
    setSponsorship(false);
    setRemote(false);
    onSearch({});         // reset results
  }

  const isActive = query.trim() !== '' || hasAdvanced;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">

      {/* ── Top row: keyword + toggle ── */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title, company or skill…"
            className="w-full pl-10 pr-4 h-10 rounded-xl border border-slate-200 bg-white
                       text-sm text-slate-700 placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                       focus:border-indigo-400 transition-all"
          />
        </div>

        {/* Advanced filters toggle */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className={[
            'h-10 px-3.5 rounded-xl border text-sm font-semibold',
            'flex items-center gap-1.5 transition-all shrink-0',
            expanded || hasAdvanced
              ? 'bg-indigo-500 text-white border-indigo-500'
              : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300',
          ].join(' ')}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasAdvanced && !expanded && (
            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
          )}
        </button>

        {/* Search submit */}
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl
                     font-semibold text-sm transition-all disabled:opacity-50 shrink-0"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* ── Expanded filter panel ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 rounded-2xl p-5
                            flex flex-col md:flex-row gap-5 md:items-center">

              {/* Location */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Location
                </label>
                <select
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm
                             font-medium text-slate-600 focus:outline-none
                             focus:border-indigo-400 cursor-pointer"
                >
                  {LOCATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              {/* Salary range */}
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Min Salary&nbsp;
                  <span className="text-indigo-600 normal-case font-bold">
                    {minSalary > 0 ? `€${(minSalary / 1000).toFixed(0)}k` : 'Any'}
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={SALARY_MAX}
                  step={SALARY_STEP}
                  value={minSalary}
                  onChange={e => setMinSalary(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Max Salary&nbsp;
                  <span className="text-indigo-600 normal-case font-bold">
                    {maxSalary > 0 ? `€${(maxSalary / 1000).toFixed(0)}k` : 'No cap'}
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={SALARY_MAX}
                  step={SALARY_STEP}
                  value={maxSalary}
                  onChange={e => setMaxSalary(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Toggles */}
              <div className="flex gap-3 shrink-0">
                {/* Remote toggle */}
                <button
                  type="button"
                  onClick={() => setRemote(v => !v)}
                  className={[
                    'flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all',
                    remote
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300',
                  ].join(' ')}
                >
                  <Wifi size={13} />
                  Remote
                </button>

                {/* Sponsorship toggle */}
                <button
                  type="button"
                  onClick={() => setSponsorship(v => !v)}
                  className={[
                    'flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all',
                    sponsorship
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300',
                  ].join(' ')}
                >
                  <Stamp size={13} />
                  Visa
                </button>
              </div>

              {/* Clear */}
              {isActive && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400
                             hover:text-rose-500 transition-colors shrink-0"
                >
                  <X size={13} /> Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { jobsApi, skillsApi } from '@/services/api';
import { JobCard, JobsListResponse } from '@/types';
import JobCardUI from '@/components/ui/JobCard';
import SkillButton from '@/components/skills/SkillButton';
import { useSkill } from '@/components/skills/useSkill';
import ComparePanel from '@/components/skills/ComparePanel';
import TriagePanel from '@/components/skills/TriagePanel';
import { Sparkles, Target, Zap, ChevronRight, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<JobsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const compareSkill = useSkill(useCallback(async () => {
    const ids = (data?.items || []).slice(0, 5).map(j => j.userJobId);
    return skillsApi.compare(ids);
  }, [data]));

  const triageSkill = useSkill(useCallback(() => skillsApi.triage(), []));

  async function load() {
    try {
      const res = await jobsApi.list();
      setData(res);
    } catch (e: any) { toast.error(e.normalizedMessage || 'Failed to load jobs'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function getMore() {
    if (!data || data.remaining <= 0) return;
    setFetching(true);
    try {
      const summary = await jobsApi.fetch(Math.min(5, data.remaining));
      toast.success(`${summary.delivered} new job${summary.delivered !== 1 ? 's' : ''} added`);
      await load();
    } catch (e: any) { toast.error(e.normalizedMessage || 'Fetch failed'); }
    finally { setFetching(false); }
  }

  const jobs: JobCard[] = data?.items || [];
  const topJobs = jobs.filter(j => j.kanbanColumn === 'Discovered' || j.kanbanColumn === 'Saved').slice(0, 5);

  return (
    <div className="space-y-10 pb-20">
      {/* Hero / Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-vibrant/10 text-brand-vibrant text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={14} />
            <span>AI Powered Matches</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
            Your Top <span className="gradient-text">Matches</span>
          </h1>
          {data && (
            <div className="flex items-center gap-3 text-slate-500">
              <p className="text-sm">
                Daily quota: <span className="font-bold text-slate-900">{data.dailyCount}</span> of <span className="text-slate-900 font-medium">{data.dailyLimit}</span>
              </p>
              <div className="h-1 w-24 bg-slate-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.dailyCount / data.dailyLimit) * 100}%` }}
                  className="h-full bg-brand-vibrant"
                />
              </div>
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-3"
        >
          <SkillButton
            label="Compare Matches"
            icon={<Target size={18} className="mr-2" />}
            state={topJobs.length < 2 ? 'locked' : compareSkill.state}
            onClick={compareSkill.run}
            className="!rounded-2xl shadow-lg"
          />
          <SkillButton
            label="Triage Queue"
            icon={<Zap size={18} className="mr-2" />}
            state={jobs.length === 0 ? 'locked' : triageSkill.state}
            onClick={triageSkill.run}
            className="!rounded-2xl shadow-lg"
          />
        </motion.div>
      </section>

      {/* Main Grid */}
      <section>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-card p-6 h-64 animate-pulse" />
            ))}
          </div>
        ) : topJobs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-20 text-center flex flex-col items-center max-w-2xl mx-auto"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Search className="text-slate-300" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No matches found yet</h3>
            <p className="text-slate-500 mb-8 max-w-md">
              We haven't found any jobs matching your profile today. Click the button below to fetch a new batch of opportunities.
            </p>
            <button
              className="btn btn-primary px-8 py-4 !rounded-2xl"
              disabled={fetching}
              onClick={getMore}
            >
              {fetching ? 'Searching...' : 'Scan for New Jobs'}
              <ChevronRight size={20} />
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topJobs.map((j, idx) => (
              <motion.div
                key={j.userJobId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <JobCardUI job={j} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Actions */}
      {data && data.remaining > 0 && topJobs.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-8"
        >
          <button
            className="group btn btn-secondary px-10 py-4 !rounded-2xl gap-3 border-2 border-transparent hover:border-brand-vibrant/20"
            disabled={fetching}
            onClick={getMore}
          >
            <div className="w-8 h-8 rounded-lg bg-brand-vibrant/10 flex items-center justify-center text-brand-vibrant group-hover:scale-110 transition-transform">
              <Search size={18} />
            </div>
            <span className="font-bold">
              {fetching ? 'Fetching Opportunities...' : `Discover ${data.remaining} More Jobs`}
            </span>
          </button>
        </motion.div>
      )}

      {/* Panels */}
      <ComparePanel
        data={compareSkill.data}
        open={compareSkill.open}
        onClose={() => compareSkill.setOpen(false)}
        jobIds={topJobs.map(j => j.userJobId)}
      />
      <TriagePanel
        data={triageSkill.data}
        open={triageSkill.open}
        onClose={() => triageSkill.setOpen(false)}
      />
    </div>
  );
}

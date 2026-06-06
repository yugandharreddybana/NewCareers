import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Award,
  BarChart2,
  CheckCircle,
  Download,
  FileText,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { useFileUpload } from '@/hooks/useFileUpload';
import {
  resumeVersionsApi,
  type CompareResult,
  type RecommendResult,
  type ResumeVersion,
} from '@/services/resumeVersionsApi';

type ResumeOutcome = 'interview' | 'offer' | 'rejected' | 'unknown';

const OUTCOME_OPTIONS: ResumeOutcome[] = ['interview', 'offer', 'rejected', 'unknown'];

const OUTCOME_STYLES: Record<ResumeOutcome, string> = {
  interview: 'bg-indigo-100 text-indigo-700',
  offer: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  unknown: 'bg-gray-100 text-gray-500',
};

function stripExtension(name: string) {
  return name.replace(/\.(pdf|docx)$/i, '');
}

function isKnownOutcome(outcome: string | null): outcome is ResumeOutcome {
  return outcome === 'interview' || outcome === 'offer' || outcome === 'rejected' || outcome === 'unknown';
}

function sortVersions(versions: ResumeVersion[]) {
  return [...versions].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function mergeVersionList(current: ResumeVersion[], next: ResumeVersion) {
  const merged = current
    .filter(version => version.id !== next.id)
    .map(version => next.isActive ? { ...version, isActive: false } : version);
  return sortVersions([next, ...merged]);
}

const UploadProgressBar = ({ progress, onAbort }: { progress: number; onAbort: () => void }) => (
  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-semibold text-indigo-700">Uploading... {progress}%</p>
      <button aria-label="Cancel upload" onClick={onAbort} title="Cancel upload" className="text-indigo-400 hover:text-red-500 transition-colors p-0.5 rounded">
        <X size={14} />
      </button>
    </div>
    <progress value={progress} max={100} className="w-full h-2" />
  </div>
);

const ResumeVersionsPage = () => {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [showOutcomeFor, setShowOutcomeFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { upload, progress, uploading, error, abort } = useFileUpload<ResumeVersion>({
    uploader: async (file, onProgress, signal) => {
      const uploaded = await resumeVersionsApi.uploadWithProgress(
        file,
        stripExtension(file.name),
        undefined,
        onProgress,
        signal,
      );

      if (versions.length === 0) {
        return resumeVersionsApi.update(uploaded.id, { isActive: true });
      }

      return uploaded;
    },
    onSuccess: version => {
      setVersions(prev => mergeVersionList(prev, version));
      void refreshRecommendation(mergeVersionList(versions, version));
      toast.success('Resume version uploaded!');
    },
    onError: () => toast.error('Upload failed.'),
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [listResponse, recommendResponse] = await Promise.all([
          resumeVersionsApi.list(),
          resumeVersionsApi.recommend().catch(() => null),
        ]);
        setVersions(sortVersions(listResponse.versions));
        setRecommendation(recommendResponse);
      } catch {
        toast.error('Failed to load resume versions.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const refreshRecommendation = async (_nextVersions?: ResumeVersion[]) => {
    try {
      setRecommendation(await resumeVersionsApi.recommend());
    } catch {
      setRecommendation(null);
    }
  };

  const handleFilePick = (file: File) => {
    if (!file.name.match(/\.(pdf|docx)$/i)) {
      toast.error('PDF or DOCX only.');
      return;
    }

    void upload(file);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this version?')) return;

    setDeleting(id);
    try {
      await resumeVersionsApi.delete(id);

      const nextVersions = versions.filter(version => version.id !== id);
      setVersions(nextVersions);
      setCompareResult(result => result && (result.left.id === id || result.right.id === id) ? null : result);
      setShowOutcomeFor(current => current === id ? null : current);
      await refreshRecommendation(nextVersions);
      toast.success('Version deleted.');
    } catch {
      toast.error('Failed to delete version.');
    } finally {
      setDeleting(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActivating(id);
    try {
      const existing = versions.find(version => version.id === id);
      if (!existing) return;

      const updated = await resumeVersionsApi.update(id, { isActive: true });

      const nextVersions = versions.map(version => version.id === id ? updated : { ...version, isActive: false });
      setVersions(sortVersions(nextVersions));
      await refreshRecommendation(sortVersions(nextVersions));
      toast.success('Active version updated.');
    } catch {
      toast.error('Failed to update the active version.');
    } finally {
      setActivating(null);
    }
  };

  const handleDownload = async (id: string) => {
    setDownloading(id);
    try {
      const { url } = await resumeVersionsApi.getDownloadUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Failed to open the resume download.');
    } finally {
      setDownloading(null);
    }
  };

  const handleSetOutcome = async (id: string, outcome: ResumeOutcome) => {
    try {
      const existing = versions.find(version => version.id === id);
      if (!existing) return;

      const updated = await resumeVersionsApi.recordOutcome(id, outcome);

      const nextVersions = mergeVersionList(versions, updated);
      setVersions(nextVersions);
      setShowOutcomeFor(null);
      await refreshRecommendation(nextVersions);
      toast.success('Outcome recorded!');
    } catch {
      toast.error('Failed to record outcome.');
    }
  };

  const handleCompare = async () => {
    if (!compareA || !compareB) return;

    setComparing(true);
    try {
      setCompareResult(await resumeVersionsApi.compare(compareA, compareB));
    } catch {
      toast.error('Failed to compare resume versions.');
    } finally {
      setComparing(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <>
      <PageMeta title="Resume Versions - NewCareers" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Resume Versions</h1>
            <p className="text-sm text-gray-500 mt-1">Track multiple resume variants and their real-world outcomes.</p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx"
              aria-label="Upload resume version file"
              title="Upload resume version file"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) handleFilePick(file);
                event.target.value = '';
              }}
            />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              <Upload size={15} /> Upload Version
            </button>
          </div>
        </div>

        {uploading && progress !== null && <UploadProgressBar progress={progress} onAbort={abort} />}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700 flex-1">{error}</p>
          </div>
        )}

        {recommendation && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <Award size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">AI Recommendation: {recommendation.recommended.name}</p>
              <p className="text-xs text-emerald-700 mt-0.5">{recommendation.reason}</p>
            </div>
          </div>
        )}

        {versions.length >= 2 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-700">Compare Two Versions</p>
            <div className="flex gap-3 items-center">
              <select aria-label="Select version A" value={compareA} onChange={event => { setCompareA(event.target.value); setCompareResult(null); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Select version A</option>
                {versions.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}
              </select>
              <span className="text-gray-400 text-sm">vs</span>
              <select aria-label="Select version B" value={compareB} onChange={event => { setCompareB(event.target.value); setCompareResult(null); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Select version B</option>
                {versions.filter(version => version.id !== compareA).map(version => <option key={version.id} value={version.id}>{version.name}</option>)}
              </select>
              <button disabled={!compareA || !compareB || comparing} onClick={() => void handleCompare()} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors">
                {comparing ? 'Comparing...' : 'Compare'}
              </button>
            </div>
            {compareResult && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-indigo-800">{compareResult.recommendation}</p>
                <div className="grid grid-cols-2 gap-4 text-xs text-indigo-700">
                  <div>
                    <p className="font-semibold">{compareResult.left.name}</p>
                    <p>{compareResult.left.applicationCount} applications</p>
                    <p>{compareResult.left.interviewCount} interviews</p>
                    <p>{compareResult.left.offerCount} offers</p>
                  </div>
                  <div>
                    <p className="font-semibold">{compareResult.right.name}</p>
                    <p>{compareResult.right.applicationCount} applications</p>
                    <p>{compareResult.right.interviewCount} interviews</p>
                    <p>{compareResult.right.offerCount} offers</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {versions.map(version => {
            const outcome = version.outcomeAssociation;
            const knownOutcome = isKnownOutcome(outcome) ? outcome : null;

            return (
              <div key={version.id} className={`bg-white border rounded-xl p-4 ${version.isActive ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${version.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                    <FileText size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{version.name}</p>
                      {version.isActive && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full"><CheckCircle size={10} /> Active</span>}
                      {version.isFavorite && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">Favorite</span>}
                      {outcome && <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${knownOutcome ? OUTCOME_STYLES[knownOutcome] : 'bg-gray-100 text-gray-600'}`}>{outcome}</span>}
                    </div>
                    {version.bestForRoleType && <p className="text-xs text-gray-400 mt-0.5">Best for: {version.bestForRoleType}</p>}
                    {version.roleTags.length > 0 && <p className="text-xs text-gray-400 mt-0.5">Tags: {version.roleTags.join(', ')}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Version {version.versionNumber} - {version.source} - {version.applicationCount} application{version.applicationCount !== 1 ? 's' : ''} - {version.interviewCount} interview{version.interviewCount !== 1 ? 's' : ''} - {version.offerCount} offer{version.offerCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Created {new Date(version.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button aria-label="Download resume version" onClick={() => void handleDownload(version.id)} disabled={downloading === version.id} title="Download resume version" className="p-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-40">
                      <Download size={14} />
                    </button>
                    {!version.isActive && <button aria-label="Set active version" onClick={() => void handleActivate(version.id)} disabled={activating === version.id} title="Set active version" className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                      <CheckCircle size={14} />
                    </button>}
                    <button aria-label="Record resume outcome" onClick={() => setShowOutcomeFor(showOutcomeFor === version.id ? null : version.id)} title="Record resume outcome" className="p-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                      <BarChart2 size={14} />
                    </button>
                    {!version.isActive && <button aria-label="Delete resume version" onClick={() => void handleDelete(version.id)} disabled={deleting === version.id} title="Delete resume version" className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                      <Trash2 size={14} />
                    </button>}
                  </div>
                </div>
                {showOutcomeFor === version.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                    <p className="text-xs text-gray-500 w-full">Record outcome for this version:</p>
                    {OUTCOME_OPTIONS.map(outcomeOption => (
                      <button key={outcomeOption} onClick={() => void handleSetOutcome(version.id, outcomeOption)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${version.outcomeAssociation === outcomeOption ? 'bg-indigo-500 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        {outcomeOption}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {versions.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
            <FileText size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No versions yet. Upload your first resume to get started.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ResumeVersionsPage;
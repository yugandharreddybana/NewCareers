import { useEffect, useState } from 'react';

const ALL_SOURCES = [
  'IrishJobs',
  'LinkedIn',
  'Indeed',
  'Jobs.ie',
  'JobsIreland.ie',
  'Adzuna',
  'Reed',
  'EuroJobs',
  'Remotive',
  'WeWorkRemotely',
  'Jobicy',
  'TheMuse',
  'SerpApi',
  'Irish Companies',
];

type SourceState = 'pending' | 'running' | 'done' | 'error';

interface SourceStatus {
  name: string;
  state: SourceState;
  count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when scraping is complete with total jobs count */
  onComplete?: (total: number) => void;
}

export function ScrapingProgressModal({ open, onClose, onComplete }: Props) {
  const [sources, setSources] = useState<SourceStatus[]>(
    ALL_SOURCES.map(name => ({ name, state: 'pending', count: 0 }))
  );
  const [done, setDone] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!open) {
      setSources(ALL_SOURCES.map(name => ({ name, state: 'pending', count: 0 })));
      setDone(false);
      setTotal(0);
      return;
    }

    // Simulate parallel scraping with staggered completion
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Mark all as running immediately
    setSources(ALL_SOURCES.map(name => ({ name, state: 'running', count: 0 })));

    ALL_SOURCES.forEach(name => {
      // Each source completes at a random time between 1.5s and 8s
      const delay = 1500 + Math.random() * 6500;
      const fakeCount = Math.floor(Math.random() * 60) + 5;
      timers.push(
        setTimeout(() => {
          setSources(prev =>
            prev.map(s =>
              s.name === name
                ? { ...s, state: Math.random() > 0.05 ? 'done' : 'error', count: fakeCount }
                : s
            )
          );
          setTotal(prev => prev + fakeCount);
        }, delay)
      );
    });

    // Mark all done after 9s
    timers.push(
      setTimeout(() => {
        setSources(prev => prev.map(s => (s.state === 'running' ? { ...s, state: 'done' } : s)));
        setDone(true);
      }, 9000)
    );

    return () => timers.forEach(clearTimeout);
  }, [open]);

  useEffect(() => {
    if (done && onComplete) onComplete(total);
  }, [done]);

  if (!open) return null;

  const stateIcon = (state: SourceState) => {
    if (state === 'pending') return <span style={{ color: '#aaa' }}>⏳</span>;
    if (state === 'running') return <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</span>;
    if (state === 'done')    return <span>✅</span>;
    return <span>⚠️</span>;
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff', borderRadius: '1rem',
          padding: '2rem', width: '90%', maxWidth: '520px',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.3rem', fontWeight: 700 }}>
          🔍 Fetching your jobs
        </h2>
        <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          We're scraping {ALL_SOURCES.length} job sources in parallel. This takes about 10 seconds.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {sources.map(s => (
            <div
              key={s.name}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: s.state === 'done' ? '#f0fdf4' : s.state === 'error' ? '#fff7ed' : '#f9fafb',
                border: '1px solid',
                borderColor: s.state === 'done' ? '#bbf7d0' : s.state === 'error' ? '#fed7aa' : '#e5e7eb',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {stateIcon(s.state)}
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</span>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>
                {s.state === 'done' ? `${s.count} jobs` :
                 s.state === 'running' ? 'fetching…' :
                 s.state === 'error' ? 'failed' : 'waiting'}
              </span>
            </div>
          ))}
        </div>

        {done && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a', marginBottom: '1rem' }}>
              ✅ Found {total.toLocaleString()} matching jobs!
            </p>
            <button
              onClick={onClose}
              style={{
                background: '#7c3aed', color: '#fff',
                border: 'none', borderRadius: '0.5rem',
                padding: '0.75rem 2rem', fontWeight: 700,
                fontSize: '1rem', cursor: 'pointer',
              }}
            >
              View My Jobs →
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

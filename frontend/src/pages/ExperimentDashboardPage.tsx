// Section 3.6 Task 80 — Experiment result tracking dashboard (admin-only)
// Shows all experiments, their variants, assignment counts, and status.
// Admin gate: only users with role 'admin' should reach this route
// (enforced at route level in ProtectedRoute or a dedicated AdminRoute wrapper).
import React, { useEffect, useState } from 'react';
import axios from '../api/axiosInstance';

interface ExperimentRow {
  id: string;
  key: string;
  name: string;
  status: string;
  variants: string[];
  trafficPct: number;
  createdAt: string;
  assignmentCounts: Record<string, number>;
  totalAssigned: number;
}

export const ExperimentDashboardPage: React.FC = () => {
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<ExperimentRow[]>('/experiments/admin/results')
      .then(r => setExperiments(r.data))
      .catch(() => setError('Failed to load experiment data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-container"><div className="skeleton skeleton-heading" /></div>;
  if (error)   return <div className="page-container"><div className="alert alert-error">{error}</div></div>;

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Experiment Dashboard</h1>
          <p className="page-subtitle">A/B test assignments and status — admin only</p>
        </div>
      </header>

      <div className="experiments-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Status</th>
              <th>Traffic %</th>
              <th>Variants</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map(exp => (
              <tr key={exp.id}>
                <td><code className="code-badge">{exp.key}</code></td>
                <td>{exp.name}</td>
                <td>
                  <span className={`status-badge status-badge--${exp.status}`}>
                    {exp.status}
                  </span>
                </td>
                <td>{exp.trafficPct}%</td>
                <td>
                  <div className="variant-pills">
                    {exp.variants.map(v => (
                      <span key={v} className="variant-pill">
                        {v}
                        <span className="variant-count">
                          {exp.assignmentCounts?.[v] ?? 0}
                        </span>
                      </span>
                    ))}
                  </div>
                </td>
                <td>{exp.totalAssigned}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {experiments.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🧪</div>
            <h3>No experiments yet</h3>
            <p>Create an experiment in the database and set its status to <code>active</code> to begin tracking assignments.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExperimentDashboardPage;

// Section 3.5 — Task 67: chart widgets for response trend and interview trend
import React from 'react';
import type { WeeklySummaryResponse } from '../api/progressApi';

interface Props {
  weeks: WeeklySummaryResponse[];
}

/**
 * Lightweight SVG bar chart — no external charting dependency needed.
 * Shows up to 8 weeks of response rate and interview rate side by side.
 */
export const ProgressCharts: React.FC<Props> = ({ weeks }) => {
  const recent = [...weeks].reverse().slice(-8);
  const maxRate = 100;
  const barW = 20;
  const gap = 8;
  const groupW = barW * 2 + gap;
  const chartW = recent.length * (groupW + 12) + 40;
  const chartH = 120;
  const barMaxH = 80;

  return (
    <div className="progress-charts">
      <h3 className="chart-title">Response & Interview Rates (%)</h3>
      <div className="chart-legend">
        <span className="legend-dot legend-dot--teal" /> Response Rate
        <span className="legend-dot legend-dot--blue" style={{ marginLeft: 16 }} /> Interview Rate
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${chartW} ${chartH}`}
        aria-label="Response and interview rate chart"
        role="img"
      >
        {recent.map((week, i) => {
          const x = 24 + i * (groupW + 12);
          const rr = week.responseRate ?? 0;
          const ir = week.interviewRate ?? 0;
          const rrH = Math.round((rr / maxRate) * barMaxH);
          const irH = Math.round((ir / maxRate) * barMaxH);
          const label = new Date(week.weekStart).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });

          return (
            <g key={week.id}>
              {/* Response Rate bar */}
              <rect
                x={x}
                y={chartH - 20 - rrH}
                width={barW}
                height={rrH || 2}
                fill="var(--color-primary)"
                rx="3"
              >
                <title>{`Response: ${rr.toFixed(1)}%`}</title>
              </rect>
              {/* Interview Rate bar */}
              <rect
                x={x + barW + gap}
                y={chartH - 20 - irH}
                width={barW}
                height={irH || 2}
                fill="var(--color-blue)"
                rx="3"
              >
                <title>{`Interview: ${ir.toFixed(1)}%`}</title>
              </rect>
              {/* Week label */}
              <text
                x={x + barW}
                y={chartH - 4}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-text-muted)"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

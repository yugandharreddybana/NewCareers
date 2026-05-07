// Section 3.5 Task 67 — ProgressCharts: multi-week bar + line charts using native SVG
// No external chart library dependency — keeps bundle lean.
import React from 'react';
import type { WeeklySummaryResponse } from '@/services/progressApi';

interface ProgressChartsProps {
  weeks: WeeklySummaryResponse[];
}

const BAR_HEIGHT = 120;
const BAR_WIDTH  = 32;
const GAP        = 12;

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function BarChart({
  weeks,
  valueKey,
  label,
  color,
}: {
  weeks: WeeklySummaryResponse[];
  valueKey: keyof WeeklySummaryResponse;
  label: string;
  color: string;
}) {
  const values = weeks.map(w => Number(w[valueKey]) || 0);
  const maxVal  = Math.max(...values, 1);
  const svgW    = weeks.length * (BAR_WIDTH + GAP);

  return (
    <div className="chart-panel">
      <h4 className="chart-title">{label}</h4>
      <svg
        width={svgW}
        height={BAR_HEIGHT + 40}
        role="img"
        aria-label={`${label} bar chart for last ${weeks.length} weeks`}
        style={{ overflow: 'visible' }}
      >
        {values.map((v, i) => {
          const week = weeks[i];
          if (!week) return null;

          const barH = Math.max(4, (v / maxVal) * BAR_HEIGHT);
          const x = i * (BAR_WIDTH + GAP);
          const y = BAR_HEIGHT - barH;
          return (
            <g key={i}>
              <rect
                x={x} y={y}
                width={BAR_WIDTH} height={barH}
                rx={4} fill={color}
                opacity={0.85}
              >
                <title>{`${formatWeekLabel(week.weekStart)}: ${v}`}</title>
              </rect>
              <text
                x={x + BAR_WIDTH / 2} y={y - 4}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                opacity={0.6}
              >
                {v}
              </text>
              <text
                x={x + BAR_WIDTH / 2} y={BAR_HEIGHT + 18}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                opacity={0.5}
              >
                {formatWeekLabel(week.weekStart)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const ProgressCharts: React.FC<ProgressChartsProps> = ({ weeks }) => {
  // Oldest first for left-to-right time axis
  const ordered = [...weeks].reverse();

  return (
    <div className="progress-charts">
      <div className="charts-scroll">
        <BarChart weeks={ordered} valueKey="applicationsSubmitted" label="Applications submitted" color="var(--color-primary)" />
        <BarChart weeks={ordered} valueKey="jobsReviewed"          label="Jobs reviewed"          color="var(--color-blue)" />
        <BarChart weeks={ordered} valueKey="interviewsScheduled"   label="Interviews scheduled"  color="var(--color-success)" />
        <BarChart weeks={ordered} valueKey="responsesReceived"     label="Responses received"    color="var(--color-gold)" />
      </div>
    </div>
  );
};

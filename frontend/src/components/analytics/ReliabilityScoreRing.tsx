import { useMemo } from 'react';

function scoreStrokeColor(score: number): string {
  if (score >= 75) return '#0d9488';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

interface Props {
  score: number;
  size?: number;
  showLabel?: boolean;
}

export function ReliabilityScoreRing({ score, size = 32, showLabel = true }: Props) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const color = scoreStrokeColor(clamped);

  const center = size / 2;

  const label = useMemo(() => Math.round(clamped).toLocaleString('en-IE'), [clamped]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-label={`Reliability score ${label} out of 100`}
      role="img"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
      {showLabel && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-700 font-semibold"
          style={{ fontSize: size <= 36 ? 9 : 12 }}
        >
          {label}
        </text>
      )}
    </svg>
  );
}

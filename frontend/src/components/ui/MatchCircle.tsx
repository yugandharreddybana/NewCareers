interface Props { percent: number; size?: number; }

export default function MatchCircle({ percent, size = 64 }: Props) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - percent / 100);
  const color = percent >= 80 ? '#6366f1' : percent >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="drop-shadow-[0_0_8px_rgba(0,0,0,0.05)]">
        <circle 
          cx={size / 2} 
          cy={size / 2} 
          r={r} 
          fill="none" 
          stroke="rgba(0,0,0,0.03)" 
          strokeWidth={4} 
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div 
        className="absolute inset-0 flex items-center justify-center font-bold tracking-tighter"
        style={{ color, fontSize: size < 60 ? 10 : 12 }}
      >
        {percent}%
      </div>
    </div>
  );
}

MatchCircle.displayName = 'MatchCircle';

import { getSourceStyle, sourceLabel } from '@/lib/jobSource';

type Props = {
  name?: string | null;
  className?: string;
};

export function JobSourceBadge({ name, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getSourceStyle(name)} ${className}`}
      title={name ?? undefined}
    >
      {sourceLabel(name)}
    </span>
  );
}

import { ResearchCompanyOutput } from './ResearchCompanyOutput';
import type { ResearchData } from '@/types/skills-data';

interface Props {
  data: ResearchData | Record<string, unknown> | null;
  open?: boolean;
  onClose?: () => void;
}

export default function ResearchPanel({ data }: Props) {
  if (!data) return null;
  return <ResearchCompanyOutput data={data as Record<string, unknown>} />;
}

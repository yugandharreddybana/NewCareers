import type { ComponentType } from 'react';

export interface JobPlannerPanelProps {
  userJobId: string;
  jobTitle?: string;
  onClose: () => void;
}

declare const JobPlannerPanel: ComponentType<JobPlannerPanelProps>;
export default JobPlannerPanel;
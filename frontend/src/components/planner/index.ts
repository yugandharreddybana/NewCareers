import type { ComponentType } from 'react';
import PlannerWidgetComponent from './PlannerWidget.jsx';
import JobPlannerPanelComponent from './JobPlannerPanel.jsx';

interface PlannerWidgetProps {
	onOpenJob?: (userJobId: string) => void;
}

interface JobPlannerPanelProps {
	userJobId: string;
	jobTitle?: string;
	onClose: () => void;
}

export const PlannerWidget = PlannerWidgetComponent as ComponentType<PlannerWidgetProps>;
export const JobPlannerPanel = JobPlannerPanelComponent as ComponentType<JobPlannerPanelProps>;

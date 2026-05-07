import type { ComponentType } from 'react';

export interface PlannerWidgetProps {
  onOpenJob?: (userJobId: string) => void;
}

declare const PlannerWidget: ComponentType<PlannerWidgetProps>;
export default PlannerWidget;
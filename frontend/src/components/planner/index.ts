import React from 'react';
// @ts-ignore
import PlannerWidgetComponent from './PlannerWidget';
// @ts-ignore
import JobPlannerPanelComponent from './JobPlannerPanel';

export const PlannerWidget = PlannerWidgetComponent as React.FC<any>;
export const JobPlannerPanel = JobPlannerPanelComponent as React.FC<any>;

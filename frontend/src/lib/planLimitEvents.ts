export interface PlanLimitPayload {
  feature: string;
  currentPlan: string;
  upgradeUrl: string;
}

type PlanLimitListener = (payload: PlanLimitPayload) => void;

const listeners = new Set<PlanLimitListener>();

export function parsePlanLimitResponse(body: Record<string, unknown>): PlanLimitPayload | null {
  const feature = body.feature;
  if (typeof feature !== 'string' || !feature) return null;
  return {
    feature,
    currentPlan: typeof body.currentPlan === 'string' ? body.currentPlan : 'FREE',
    upgradeUrl: typeof body.upgradeUrl === 'string' ? body.upgradeUrl : '/pricing',
  };
}

export function emitPlanLimitExceeded(payload: PlanLimitPayload): void {
  listeners.forEach((listener) => listener(payload));
}

export function subscribePlanLimitExceeded(listener: PlanLimitListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

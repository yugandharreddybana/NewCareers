export type ApplyGateLevel = 'go' | 'caution' | 'stop';

export function applyGate(applyScore?: number): { level: ApplyGateLevel; message: string } {
  if (applyScore == null || Number.isNaN(applyScore)) {
    return {
      level: 'caution',
      message: 'Run a full evaluation for an apply recommendation.',
    };
  }
  if (applyScore >= 4) {
    return { level: 'go', message: 'Meets NewCareers apply threshold (4.0/5).' };
  }
  if (applyScore >= 3) {
    return { level: 'caution', message: 'Stretch role — improve gaps before applying.' };
  }
  return { level: 'stop', message: 'Below apply threshold — consider skipping.' };
}

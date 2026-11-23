// The hold decision is deliberately simple and deterministic.
// AI helps investigators; it does not make this call.

export const HOLD_MULTIPLE = 3; // hold when exposure passes 3x the account's own typical level
export const WEIGHT_THRESHOLD_OZ = 3; // flag when the scanned weight differs from declared by more than this

export function decide({ exposure_usd, typical_exposure_usd, delta_oz }) {
  const reasons = [];
  const overExposure = exposure_usd > HOLD_MULTIPLE * typical_exposure_usd;
  const weightMismatch = Math.abs(delta_oz || 0) > WEIGHT_THRESHOLD_OZ;
  if (overExposure) reasons.push('EXPOSURE_OVER_3X_TYPICAL');
  if (weightMismatch) reasons.push('WEIGHT_MISMATCH');
  const action = overExposure ? 'HOLD' : weightMismatch ? 'REVIEW' : 'RELEASE';
  return { action, reasons };
}

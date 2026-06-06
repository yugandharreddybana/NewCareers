// Section 3.6 Task 75 — Upgrade experiments for paywall placement and messaging
// Reads variant from ExperimentContext to A/B test CTA copy and placement.
import React from 'react';
import { useExperiment } from '../../context/ExperimentContext';

interface UpgradePaywallProps {
  feature: string;         // e.g. 'mock_interview', 'workspace_invite'
  onUpgrade?: () => void;
  onDismiss?: () => void;
  inline?: boolean;        // true = banner, false = modal-style blocker
}

const COPY_VARIANTS: Record<string, { headline: string; subtext: string; cta: string }> = {
  control: {
    headline: 'Premium feature',
    subtext: 'Upgrade your plan to unlock this and all other premium NewCareers features.',
    cta: 'Upgrade to Premium',
  },
  value_focus: {
    headline: 'Land interviews faster',
    subtext: 'Premium members get 3× more interview callbacks. Unlock mock interviews, workspace sharing, and unlimited skill runs.',
    cta: 'Start my free trial',
  },
  urgency: {
    headline: 'Limited free usage remaining',
    subtext: 'You\'ve used your free skill runs for this week. Upgrade to continue your momentum without interruption.',
    cta: 'Unlock unlimited access',
  },
};

const DEFAULT_COPY = {
  headline: 'Premium feature',
  subtext: 'Upgrade your plan to unlock this and all other premium NewCareers features.',
  cta: 'Upgrade to Premium',
};

export const UpgradePaywall: React.FC<UpgradePaywallProps> = ({
  feature,
  onUpgrade,
  onDismiss,
  inline = false,
}) => {
  const { getVariant } = useExperiment();
  const variant = getVariant('paywall_messaging', 'control');
  const copy = COPY_VARIANTS[variant] ?? COPY_VARIANTS.control ?? DEFAULT_COPY;
  const canUpgrade = typeof onUpgrade === 'function';

  const featureLabel: Record<string, string> = {
    mock_interview:   'Mock Interviews',
    workspace_invite: 'Mentor Collaboration',
    unlimited_skills: 'Unlimited Skill Runs',
    interview_kit:    'Interview Kits',
  };

  return (
    <div className={`paywall ${inline ? 'paywall--inline' : 'paywall--block'}`} role="region" aria-label="Upgrade required">
      <div className="paywall__badge">✨ Premium</div>
      <h3 className="paywall__headline">{copy.headline}</h3>
      <p className="paywall__subtext">{copy.subtext}</p>
      {feature && featureLabel[feature] && (
        <p className="paywall__feature-label">
          Requires: <strong>{featureLabel[feature]}</strong>
        </p>
      )}
      <div className="paywall__actions">
        <button
          type="button"
          className="btn btn-primary paywall__cta disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onUpgrade?.()}
          disabled={!canUpgrade}
        >
          {canUpgrade ? copy.cta : 'Billing coming soon'}
        </button>
        {onDismiss && (
          <button type="button" className="btn btn-ghost paywall__dismiss" onClick={onDismiss}>
            Maybe later
          </button>
        )}
      </div>
      {!canUpgrade && (
        <p className="paywall__subtext">Billing is not enabled in this environment yet.</p>
      )}
    </div>
  );
};

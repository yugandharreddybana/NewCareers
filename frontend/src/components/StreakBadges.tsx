// Section 3.5 — Task 65: badge and milestone UI
import React from 'react';
import type { BadgeDTO } from '../api/progressApi';

interface Props {
  badges: BadgeDTO[];
}

export const StreakBadges: React.FC<Props> = ({ badges }) => (
  <div className="streak-badges">
    {badges.map(badge => (
      <div
        key={badge.key}
        className={`streak-badge${badge.earned ? ' streak-badge--earned' : ' streak-badge--locked'}`}
        title={badge.earned ? badge.label : `${badge.label} — not yet earned`}
      >
        <span className="badge-icon" aria-hidden="true">{badge.icon}</span>
        <span className="badge-label">{badge.label}</span>
        {!badge.earned && <span className="badge-lock" aria-label="Locked">🔒</span>}
      </div>
    ))}
  </div>
);

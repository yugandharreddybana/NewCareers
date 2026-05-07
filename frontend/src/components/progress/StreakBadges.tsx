// Section 3.5 Task 65 — StreakBadges component
import React from 'react';
import type { BadgeDTO } from '@/services/progressApi';

interface StreakBadgesProps {
  badges: BadgeDTO[];
}

export const StreakBadges: React.FC<StreakBadgesProps> = ({ badges }) => (
  <div className="badges-grid" role="list" aria-label="Milestone badges">
    {badges.map(badge => (
      <div
        key={badge.key}
        role="listitem"
        className={`badge-card ${badge.earned ? 'badge-card--earned' : 'badge-card--locked'}`}
        aria-label={`${badge.label} — ${badge.earned ? 'earned' : 'not yet earned'}`}
      >
        <span className="badge-icon" aria-hidden="true">
          {badge.earned ? badge.icon : '🔒'}
        </span>
        <span className="badge-label">{badge.label}</span>
        {!badge.earned && <span className="badge-locked-text">Not yet earned</span>}
      </div>
    ))}
  </div>
);

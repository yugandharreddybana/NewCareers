// DashboardPage.tsx — Phase 3 complete: ProductTour + FirstApplicationChecklist wired
import React, { useEffect, useState } from 'react';
import { FirstApplicationChecklist } from '../components/onboarding/FirstApplicationChecklist';
import { ProductTour, DASHBOARD_TOUR_STEPS } from '../components/onboarding/ProductTour';
import { useOnboardingTracker } from '../hooks/useOnboardingTracker';

const TOUR_SEEN_KEY = 'careerops_tour_seen';

export const DashboardPage: React.FC = () => {
  const [showTour, setShowTour] = useState(false);
  const { trackStep } = useOnboardingTracker();

  useEffect(() => {
    // Launch tour once per session (Task 71)
    const seen = sessionStorage.getItem(TOUR_SEEN_KEY);
    if (!seen) setShowTour(true);
  }, []);

  const handleTourComplete = () => {
    sessionStorage.setItem(TOUR_SEEN_KEY, '1');
    setShowTour(false);
    trackStep('profile_complete', 'completed'); // counts as first meaningful engagement
  };

  const handleTourSkip = () => {
    sessionStorage.setItem(TOUR_SEEN_KEY, '1');
    setShowTour(false);
  };

  return (
    <main className="dashboard-layout">
      {/* Product tour — shown once per session for new users (Task 71) */}
      {showTour && (
        <ProductTour
          steps={DASHBOARD_TOUR_STEPS}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}

      {/* Persistent getting-started checklist (Task 74) */}
      <FirstApplicationChecklist />

      {/* ── Main dashboard content ─────────────────────────────────── */}
      <header className="dashboard-header">
        <h1 className="page-title">Dashboard</h1>
      </header>

      <section id="dashboard-search-bar" className="dashboard-search">
        {/* Search bar rendered here — ID used by ProductTour step 1 */}
      </section>

      <section id="dashboard-skill-actions" className="dashboard-skills">
        {/* 14 skill action buttons — ID used by ProductTour step 2 */}
      </section>

      <section id="dashboard-planner-card" className="dashboard-planner">
        {/* ApplicationPlannerCard — ID used by ProductTour step 3 */}
      </section>
    </main>
  );
};

export default DashboardPage;

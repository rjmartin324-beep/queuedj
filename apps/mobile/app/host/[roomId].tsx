import React, { useEffect, useState } from "react";
import HostScreen from "../../src/screens/HostScreen";
import HostOnboardingScreen, { shouldShowHostOnboarding } from "../../src/screens/HostOnboardingScreen";

export default function HostRoomRoute() {
  const [checked, setChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    shouldShowHostOnboarding().then((show) => {
      setShowOnboarding(show);
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  if (showOnboarding) {
    return <HostOnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  return <HostScreen />;
}

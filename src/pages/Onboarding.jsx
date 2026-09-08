import { useEffect } from 'react';

// Onboarding is now part of the rebuilt signup flow (/Signup handles both
// screens). This page stays as a redirect so old links keep working.
export default function Onboarding() {
  useEffect(() => {
    window.location.href = '/Signup';
  }, []);
  return null;
}
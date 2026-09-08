import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSchool } from '@/lib/SchoolContext';

/**
 * UnverifiedSchoolBanner — persistent notice for self-service schools that
 * BlockWard hasn't verified yet. The school works normally, but blockchain-
 * anchored credentials stay paused until verification.
 */
export default function UnverifiedSchoolBanner() {
  const { activeSchool: school } = useSchool();
  if (!school || school.verification_status !== 'unverified') return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
      <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-warning">{school.name} isn't verified yet</p>
        <p className="text-muted-foreground mt-0.5">
          You can use BlockWard normally — records, sign-offs and classes all work.
          Permanently recorded (blockchain-anchored) credentials are paused until BlockWard verifies your organisation.
        </p>
      </div>
    </div>
  );
}
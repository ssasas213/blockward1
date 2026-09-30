import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import AllRecordsTab from '@/components/records/AllRecordsTab';

/**
 * Records — the organisation owner's credentials hub. Lists every achievement
 * record for review, signing, delivery and verification. (Grade management
 * — a legacy school-management feature — was removed during the product
 * pivot and is no longer a tab here.)
 */
export default function Records() {
  return (
    <RoleGuard roles={['admin']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Records</h1>
          <p className="text-muted-foreground mt-1">
            Every achievement record — review, sign, deliver, and verify
          </p>
        </div>
        <AllRecordsTab />
      </div>
    </RoleGuard>
  );
}
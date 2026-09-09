import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/lib/SchoolContext';

/**
 * ApprovalsCountBadge — the combined admin Approvals badge: achievement
 * sign-offs waiting on this reviewer PLUS staff (teacher) join requests
 * pending in the active school. Staff approvals contribute to the badge so
 * they can never again sit invisible behind a zero.
 */
export default function ApprovalsCountBadge() {
  const { activeSchool } = useSchool();
  const [signoffs, setSignoffs] = useState(0);
  const [staff, setStaff] = useState(0);

  const loadSignoffs = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('achievementRequestData', { mode: 'reviewer' });
      setSignoffs(res.data?.ok ? (res.data.queue || []).length : 0);
    } catch {
      setSignoffs(0);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    if (!activeSchool?.id) { setStaff(0); return; }
    try {
      const items = await base44.entities.StaffMembership.filter({
        school_id: activeSchool.id,
        status: 'pending',
      });
      setStaff(items.length);
    } catch {
      setStaff(0);
    }
  }, [activeSchool?.id]);

  useEffect(() => {
    loadSignoffs();
    loadStaff();
    try {
      const u1 = base44.entities.AchievementRequest.subscribe(() => loadSignoffs());
      const u2 = base44.entities.StaffMembership.subscribe(() => loadStaff());
      return () => { try { u1(); u2(); } catch { /* noop */ } };
    } catch {
      return undefined;
    }
  }, [loadSignoffs, loadStaff]);

  const total = signoffs + staff;
  if (!total) return null;
  return (
    <Badge
      title={`${signoffs} achievement sign-off${signoffs === 1 ? '' : 's'} · ${staff} staff approval${staff === 1 ? '' : 's'}`}
      className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 min-w-5 justify-center flex-shrink-0"
    >
      {total}
    </Badge>
  );
}
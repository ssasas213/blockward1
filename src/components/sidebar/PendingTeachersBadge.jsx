import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/lib/SchoolContext';

/**
 * PendingTeachersBadge — live count of teachers waiting for approval in the
 * active school. Hidden when zero; refreshes when staff memberships change.
 */
export default function PendingTeachersBadge() {
  const { activeSchool } = useSchool();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!activeSchool?.id) { setCount(0); return; }
    try {
      const items = await base44.entities.StaffMembership.filter({
        school_id: activeSchool.id,
        status: 'pending',
      });
      setCount(items.length);
    } catch {
      setCount(0);
    }
  }, [activeSchool?.id]);

  useEffect(() => {
    load();
    try {
      const unsub = base44.entities.StaffMembership.subscribe(() => load());
      return unsub;
    } catch {
      return undefined;
    }
  }, [load]);

  if (!count) return null;
  return (
    <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5 min-w-5 justify-center flex-shrink-0">
      {count}
    </Badge>
  );
}
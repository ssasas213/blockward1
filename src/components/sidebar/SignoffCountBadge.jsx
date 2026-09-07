import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';

/**
 * SignoffCountBadge — live count of achievement requests waiting for this
 * teacher's sign-off. Refreshes when requests change; hidden when zero.
 */
export default function SignoffCountBadge() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('achievementRequestData', { mode: 'reviewer' });
      setCount(res.data?.ok ? (res.data.queue || []).length : 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = base44.entities.AchievementRequest.subscribe(() => load());
    return unsub;
  }, [load]);

  if (!count) return null;
  return (
    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 min-w-5 justify-center flex-shrink-0">
      {count}
    </Badge>
  );
}
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SignoffDialog from '@/components/achievements/SignoffDialog';
import { PenLine, ChevronRight, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * SignoffQueueWidget — the teacher's pending sign-off queue: the live count
 * and the three oldest waiting requests, signable inline without leaving the
 * dashboard.
 */
export default function SignoffQueueWidget() {
  const [queue, setQueue] = useState(null);
  const [signTarget, setSignTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('achievementRequestData', { mode: 'reviewer' });
      setQueue(res.data?.ok ? (res.data.queue || []) : []);
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSignConfirm = async (signoff) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('achievementRequestAction', {
        action: 'sign', request_id: signTarget.id, ...signoff,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Sign-off failed');
      toast.success('Signed off — publishing');
      setSignTarget(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (queue === null) return null;

  // Oldest first — the longest-waiting requests surface at the top.
  const oldest = [...queue]
    .sort((a, b) => new Date(a.submitted_at || a.created_date || 0) - new Date(b.submitted_at || b.created_date || 0))
    .slice(0, 3);

  return (
    <>
      <Card className={cn("shadow-sm", queue.length > 0 && "border-warning/30")}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", queue.length > 0 ? "bg-warning/10" : "bg-muted")}>
              <ClipboardCheck className={cn("h-4 w-4", queue.length > 0 ? "text-warning" : "text-muted-foreground")} />
            </div>
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                Pending sign-offs
                <Badge variant={queue.length > 0 ? 'warning' : 'secondary'}>{queue.length} waiting</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Achievement requests where you are the nominated verifier
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={createPageUrl('PendingSignoffs')}>
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {queue.length === 0 ? (
            <div className="flex items-center gap-2 py-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="text-sm text-muted-foreground">All caught up — nothing waiting for your signature.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {oldest.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 p-3 bg-warning/5 border border-warning/20 rounded-lg"
                >
                  <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center font-medium text-warning text-sm flex-shrink-0">
                    {r.student_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.student_name}
                      {r.submitted_at && ` · submitted ${new Date(r.submitted_at).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSignTarget(r)} disabled={busy}>
                    <PenLine className="h-4 w-4 mr-1.5" /> Sign off
                  </Button>
                </div>
              ))}
              {queue.length > 3 && (
                <p className="text-xs text-muted-foreground pt-1">
                  + {queue.length - 3} more waiting in your sign-off queue
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SignoffDialog
        open={!!signTarget}
        onOpenChange={(o) => !o && setSignTarget(null)}
        title={`Sign off "${signTarget?.title}"`}
        description="Choose how you verified this, confirm the attestation, and sign. On sign-off the credential is published to the student's profile."
        confirmLabel="Sign off & publish"
        busy={busy}
        onConfirm={onSignConfirm}
      />
    </>
  );
}
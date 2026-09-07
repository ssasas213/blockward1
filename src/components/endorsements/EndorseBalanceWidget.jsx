import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Quote, ArrowRight } from 'lucide-react';
import EndorseDialog from './EndorseDialog';

/**
 * EndorseBalanceWidget — the prominent per-term endorsement balance.
 * Shows remaining budget as filled dots (they don't roll over), the reset
 * date, given/received counts, and opens the invite flow.
 */
export default function EndorseBalanceWidget() {
  const [data, setData] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('endorsementData', {});
      if (res.data?.ok) setData(res.data);
    } catch (e) { /* endorsements are optional — widget stays hidden */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data || !data.balance) return null;
  const { budget, remaining, term } = data.balance;
  const reset = term?.end_date
    ? new Date(term.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <Card className="surface-card border-brand-gradient">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Quote className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Peer endorsements this term</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: budget }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rounded-full ${i < remaining ? 'bg-primary' : 'bg-border'}`}
                    />
                  ))}
                </div>
                <span className={`text-sm font-bold ${remaining === 0 ? 'text-tertiary' : 'text-foreground'}`}>
                  {remaining} of {budget} left
                </span>
              </div>
              <p className="text-xs text-tertiary mt-1.5">
                {reset ? `Resets ${reset} — unused endorsements don't roll over.` : 'Unused endorsements don\u2019t roll over.'}
                {data.given?.length > 0 && ` Given ${data.given.length}.`}
                {data.received?.length > 0 && ` Received ${data.received.length}.`}
              </p>
              {data.claimed > 0 && (
                <p className="text-xs text-success mt-1 font-medium">
                  {data.claimed} endorsement{data.claimed === 1 ? '' : 's'} waiting for you — now on your profile.
                </p>
              )}
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="flex-shrink-0 w-full sm:w-auto">
            Endorse someone
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </CardContent>
      <EndorseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="invite"
        onDone={load}
      />
    </Card>
  );
}
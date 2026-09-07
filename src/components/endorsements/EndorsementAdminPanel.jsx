import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Quote, CheckCircle2, Loader2, Users } from 'lucide-react';

/**
 * EndorsementAdminPanel — org-admin view of the endorsement programme:
 * invite funnel (sent, claimed, conversion rate), take-up this term, and the
 * configurable settings — term length (default 90 days) and per-term budget.
 */
export default function EndorsementAdminPanel() {
  const [data, setData] = useState(null);
  const [periodDays, setPeriodDays] = useState(90);
  const [budget, setBudget] = useState(3);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('endorsementData', {});
      if (res.data?.ok && res.data.admin) {
        setData(res.data.admin);
        if (res.data.admin.term) {
          setPeriodDays(res.data.admin.term.period_days || 90);
          setBudget(res.data.admin.term.budget || 3);
        }
      }
    } catch (e) { /* panel hidden for non-admins */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('endorsementAction', {
        action: 'admin_update_term',
        period_days: Number(periodDays),
        budget: Number(budget),
      });
      if (res.data?.ok) {
        setSavedAt(Date.now());
        load();
      } else {
        setError(res.data?.error || 'Could not save settings.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Quote className="h-4 w-4 text-primary" /> Peer Endorsements
        </CardTitle>
        {data.term && (
          <span className="text-xs text-tertiary">
            {data.term.name} · ends {new Date(data.term.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite funnel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-center">
            <p className="text-xl font-bold text-foreground">{data.invites_sent}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Invites sent</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-center">
            <p className="text-xl font-bold text-foreground">{data.invites_claimed}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Claims</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-center">
            <p className="text-xl font-bold text-primary">{data.conversion_rate}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Conversion</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-center">
            <p className="text-xl font-bold text-foreground">{data.endorsements_this_term}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">This term</p>
          </div>
        </div>

        {/* Scarcity settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="endorse-period">Term length (days)</Label>
            <Input id="endorse-period" type="number" min={7} max={365} value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endorse-budget">Endorsements per person per term</Label>
            <Input id="endorse-budget" type="number" min={1} max={10} value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : savedAt ? (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> Saved</>
            ) : (
              'Save settings'
            )}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-tertiary flex items-start gap-1.5">
          <Users className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          Endorsements are capped at 20 per achievement, never anonymous, and never roll over between terms — that scarcity is what makes them worth reading.
        </p>
      </CardContent>
    </Card>
  );
}
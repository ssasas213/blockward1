import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FlaskConical, Sprout, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * DemoDataCard — super-admin testing tool. Seeds a complete demo organisation
 * through the real provisioning paths (one admin, two pending teachers, twenty
 * students, a class, timetable, attendance history and achievements at
 * different lifecycle stages), and removes it in one action.
 */
export default function DemoDataCard() {
  const [checking, setChecking] = useState(true);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('seedDemoOrganisation', { action: 'status' });
      setRun(res.data?.run || null);
    } catch {
      setRun(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const seed = async () => {
    if (!window.confirm('Create a complete demo organisation?\n\nThis provisions one admin, two pending teachers, twenty students with a class, timetable, attendance history and achievements — all through the real signup paths, and all removable in one action.')) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('seedDemoOrganisation', { action: 'seed' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Seed failed');
      toast.success(`Demo organisation "${res.data.school?.name || 'created'}" is ready`);
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Seed failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove the demo organisation and every record it created?')) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('seedDemoOrganisation', { action: 'remove' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Removal failed');
      toast.success('Demo organisation removed');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Removal failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Demo & testing data
        </CardTitle>
        <CardDescription>
          Seed a complete demo organisation through the real signup and school-creation paths — one admin, two pending teachers, twenty students, a class, timetable, attendance and achievements at different stages. Removable in one action.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {checking ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : run ? (
          <>
            <p className="text-sm text-muted-foreground flex-1 min-w-0">
              Active: <strong className="text-foreground">{run.school_name}</strong>
              {run.seeded_at ? ` · seeded ${new Date(run.seeded_at).toLocaleDateString()}` : ''}
            </p>
            <Button variant="outline" size="sm" onClick={remove} disabled={busy} className="text-destructive hover:text-destructive">
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Remove demo data
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground flex-1">No demo organisation seeded yet.</p>
            <Button size="sm" onClick={seed} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sprout className="h-3.5 w-3.5 mr-1.5" />}
              Seed demo organisation
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, ArrowRight, Check, AlertTriangle, Clock } from 'lucide-react';

/**
 * CodeJoinCard — join (or switch to) a school with a join code. The role is
 * derived from the code server-side: students join immediately, teachers are
 * queued for admin approval.
 */
export default function CodeJoinCard({ onJoined }) {
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('joinSchoolByCode', { code: joinCode.trim() });
      const data = response.data;
      if (data.status === 'pending') {
        setResult({ pending: true, message: data.message, schoolName: data.school_name });
      } else {
        setResult({ success: true, message: data.message, schoolName: data.school_name });
        if (onJoined) onJoined(data);
      }
    } catch (error) {
      setResult({ error: error.response?.data?.error || error.message || 'Failed to join school' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Have a join code?
        </CardTitle>
        <CardDescription>Students join immediately. Teachers are approved by an administrator.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Join code</Label>
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="e.g. SCH-STUD-7K4P92"
            className="font-mono uppercase tracking-wider"
            disabled={submitting || result?.success}
          />
        </div>

        {result?.error && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">{result.error}</div>
        )}
        {result?.pending && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-sm text-warning flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">{result.schoolName}</p>
                <p className="mt-0.5">{result.message}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> You can sign in, but teacher tools stay locked until an admin approves you.
            </p>
          </div>
        )}
        {result?.success && (
          <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-sm text-success flex items-center gap-2">
            <Check className="h-4 w-4" /> {result.message}
          </div>
        )}

        {!result?.success && !result?.pending && (
          <Button onClick={handleJoin} disabled={submitting || !joinCode.trim()} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
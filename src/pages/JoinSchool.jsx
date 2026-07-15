import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, ArrowRight, Loader2, Check, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinSchool() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) setProfile(profiles[0]);
      }
    } catch {
      window.location.href = '/Login';
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Please enter a school code'); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('joinSchoolByCode', {
        code: joinCode.trim(),
        role_type: 'teacher',
      });
      const data = response.data;
      if (data.status === 'pending') {
        setResult({ pending: true, message: data.message, schoolName: data.school_name });
      } else {
        setResult({ success: true, message: data.message, schoolName: data.school_name });
        setTimeout(() => { window.location.href = createPageUrl('TeacherDashboard'); }, 2500);
      }
    } catch (error) {
      setResult({ error: error.response?.data?.error || error.message || 'Failed to join school' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If already has a school, redirect
  if (profile?.school_id) {
    window.location.href = createPageUrl('TeacherDashboard');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Join a School</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter the teacher join code provided by your school administrator
          </p>
        </div>

        <Card className="border-border bg-card/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Teacher Join Code</CardTitle>
            <CardDescription>Your request will be sent to the school admin for approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>School Code</Label>
              <Input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="e.g. IHS-TEACH-7K4P92"
                className="font-mono uppercase"
              />
            </div>

            {result?.error && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">{result.error}</div>
            )}
            {result?.pending && (
              <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-sm text-warning flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{result.schoolName}</p>
                  <p className="mt-0.5">{result.message}</p>
                </div>
              </div>
            )}
            {result?.success && (
              <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-sm text-success flex items-center gap-2">
                <Check className="h-4 w-4" /> {result.message}
              </div>
            )}

            <Button onClick={handleJoin} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit Request <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Loader2, Check, AlertTriangle, Users, GraduationCap, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinSchool() {
  const [profile, setProfile] = useState(null);
  const [pendingMembership, setPendingMembership] = useState(null);
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
      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          const p = profiles[0];
          setProfile(p);

          // Already linked to a school — go straight to the right dashboard
          if (p.school_id) {
            redirectByRole(p.user_type);
            return;
          }

          // Teacher with no school yet — check for a pending join request so we
          // show a "pending approval" state instead of the join form again.
          if (p.user_type === 'teacher') {
            try {
              const staff = await base44.entities.StaffMembership.filter({ user_email: currentUser.email });
              const pending = staff.find(s => s.status === 'pending');
              if (pending) setPendingMembership(pending);
            } catch { /* ignore */ }
          }
        }
      }
    } catch {
      window.location.href = '/Login';
    } finally {
      setLoading(false);
    }
  };

  const redirectByRole = (role) => {
    const page = role === 'admin' ? 'AdminDashboard' : role === 'teacher' ? 'TeacherDashboard' : 'StudentDashboard';
    window.location.href = createPageUrl(page);
  };

  const role = profile?.user_type || 'teacher';
  const isStudent = role === 'student';

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Please enter a school code'); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('joinSchoolByCode', {
        code: joinCode.trim(),
        role_type: role,
      });
      const data = response.data;
      if (data.status === 'pending') {
        setResult({ pending: true, message: data.message, schoolName: data.school_name });
      } else {
        // Student (auto-approved) — linked immediately; new students go through guided setup
        setResult({ success: true, message: data.message, schoolName: data.school_name });
        setTimeout(() => {
          if (role === 'student') {
            window.location.href = createPageUrl('StudentOnboarding');
          } else {
            redirectByRole(role);
          }
        }, 1800);
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

  // Teacher with a pending request — show pending state, not the join form
  if (pendingMembership) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mb-5">
                <Clock className="h-8 w-8 text-warning" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Request Pending Approval</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your request to join this school has been sent to the administrator.
                You'll be able to access the platform once your request is approved.
              </p>
              <Button
                onClick={() => base44.auth.logout(window.location.origin + '/Login')}
                variant="outline"
                className="w-full"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const RoleIcon = isStudent ? GraduationCap : Users;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <RoleIcon className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Join a School</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isStudent
              ? 'Enter the student code provided by your school to get started'
              : 'Enter the teacher code provided by your school administrator'}
          </p>
        </div>

        <Card className="border-border bg-card/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">{isStudent ? 'Student Code' : 'Teacher Code'}</CardTitle>
            <CardDescription>
              {isStudent
                ? 'You will be linked to the school immediately, then join a class'
                : 'Your request will be sent to the school admin for approval'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>School Code</Label>
              <Input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder={isStudent ? 'e.g. IHS-STUDENT-7K4P92' : 'e.g. IHS-TEACH-7K4P92'}
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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                {isStudent ? 'Join School' : 'Submit Request'} <ArrowRight className="h-4 w-4 ml-2" />
              </>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
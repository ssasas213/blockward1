import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

// Fallback profile provisioning for authenticated users without a profile
// (e.g. a Google return without stashed signup details). Roles are derived
// entirely server-side by provisionProfile — this form only collects the name
// and an OPTIONAL join code.
const NEXT_URL = {
  awaiting_approval: '/Login',
  student_setup: '/StudentOnboarding',
  teacher_dashboard: '/TeacherDashboard',
  admin_dashboard: '/AdminDashboard',
  join_school: '/JoinSchool',
  login: '/Login',
};

export default function Onboarding() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (currentUser) {
          const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
          if (profiles.length > 0 && profiles[0].status !== 'pending_approval') {
            window.location.href = '/Login';
            return;
          }
        }
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('provisionProfile', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        join_code: joinCode.trim() || undefined,
      });
      const data = res.data;
      if (!data?.ok) throw new Error(data?.error || 'Failed to create account');
      window.location.href = NEXT_URL[data.next] || createPageUrl('JoinSchool');
    } catch (error) {
      console.error('Error provisioning profile:', error);
      toast.error(error.message || 'Failed to create account');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <Card className="w-full max-w-lg border-border bg-card/60 backdrop-blur-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Welcome to BlockWard</CardTitle>
          <CardDescription>Tell us who you are — your school decides your role when you join</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> School code (optional)
              </Label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Have a code from your school? Enter it here"
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                With a code you join your school straight away. Without one you'll choose a school next.
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!firstName.trim() || !lastName.trim() || submitting}
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
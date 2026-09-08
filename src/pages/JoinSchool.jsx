import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Plus, Clock, GraduationCap, Users } from 'lucide-react';
import { toast } from 'sonner';
import SchoolSearchCard from '@/components/join/SchoolSearchCard';
import CodeJoinCard from '@/components/join/CodeJoinCard';

/**
 * JoinSchool — the "join or create a school" hub. Three paths, never a dead
 * end: search for your school and request to join, enter a join code, or
 * create a new school. Users with user_type 'pending' (signed up with no code
 * or invitation) land here after signup.
 */
export default function JoinSchool() {
  const [profile, setProfile] = useState(null);
  const [pendingMembership, setPendingMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAuth(); }, []);

  const loadAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser) {
        // Test Super User bypass: auto-provisioned server-side — never show the join form.
        try {
          const tm = await base44.functions.invoke('getTestModeStatus');
          if (tm.data?.is_test_super_user) {
            window.location.href = createPageUrl('AdminDashboard');
            return;
          }
        } catch { /* not the test super user */ }

        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          const p = profiles[0];
          setProfile(p);
          if (p.status === 'pending_approval' || p.user_type === 'teacher') {
            try {
              const staff = await base44.entities.StaffMembership.filter({ user_email: currentUser.email });
              const pending = staff.find(s => s.status === 'pending') || (p.status === 'pending_approval' ? {} : null);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  // A teacher awaiting approval — clear holding state instead of the join form.
  if (pendingMembership) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mb-5">
                <Clock className="h-8 w-8 text-warning" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Awaiting approval</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your request to join {profile?.school_id ? 'this school' : 'your school'} has been sent to the administrator.
                You can sign in, but you won't be able to sign off achievements, view student data, take attendance or issue points until an admin approves you.
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

  const role = profile?.user_type || 'pending';
  const canSearch = role === 'student' || role === 'pending';
  const canCreateSchool = role === 'pending' || role === 'admin';

  const handleJoined = (data) => {
    toast.success(data.message || `You have joined ${data.school_name}.`);
    setTimeout(() => {
      window.location.href = data.role === 'teacher' ? '/TeacherDashboard' : '/StudentDashboard';
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            {role === 'teacher' ? <Users className="h-7 w-7 text-primary" /> : <GraduationCap className="h-7 w-7 text-primary" />}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Join a school</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Search for your school, enter a join code, or create a new school.
          </p>
        </div>

        <div className="space-y-4">
          {canSearch ? (
            <SchoolSearchCard />
          ) : (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardContent className="p-5 flex items-start gap-3">
                <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Teachers join with a code or an invitation</p>
                  <p className="text-muted-foreground mt-0.5">
                    Ask your school administrator for a join code, or have them email you an invitation.
                    You'll get full access once they approve you.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <CodeJoinCard onJoined={handleJoined} />

          {canCreateSchool && (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Setting up a new school?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You'll be the administrator of your school. New schools start unverified.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                  <Link to={createPageUrl('SchoolSetup')}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Create school
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
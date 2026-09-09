import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSchool } from '@/lib/SchoolContext';
import { toLogin, logoutToLogin } from '@/lib/authRedirectGuard';
import { Building2, Plus, Clock, GraduationCap, Users, ArrowRight } from 'lucide-react';
import CodeJoinCard from '@/components/join/CodeJoinCard';
import SchoolSearchCard from '@/components/join/SchoolSearchCard';
import InviteOrganisationCard from '@/components/join/InviteOrganisationCard';

/**
 * AddSchoolOrClub (JoinSchool) — the optional "Add your school or club" hub.
 * BlockWard is fully usable without an organisation, so nothing here blocks:
 * join with a code (fastest), search for an organisation and request to
 * join, invite one that isn't on BlockWard yet, or create a new school
 * (admin path). Students can always come back later — a school-less student
 * is a complete account. Identity comes from SchoolContext — no auth fetches.
 */
export default function JoinSchool() {
  const { user, profile, testMode, loading: ctxLoading } = useSchool();
  const [pendingMembership, setPendingMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctxLoading) return;
    if (!user) { toLogin(); return; }
    // Test Super User bypass: auto-provisioned server-side — never show the join form.
    if (testMode?.isTestSuperUser) {
      window.location.href = createPageUrl('AdminDashboard');
      return;
    }
    let cancelled = false;
    const finish = () => { if (!cancelled) setLoading(false); };
    if (profile?.status === 'pending_approval' || profile?.user_type === 'teacher') {
      base44.entities.StaffMembership.filter({ user_email: user.email })
        .then((staff) => {
          if (cancelled) return;
          const pending = staff.find(s => s.status === 'pending') || (profile?.status === 'pending_approval' ? {} : null);
          if (pending) setPendingMembership(pending);
        })
        .catch(() => {})
        .finally(finish);
    } else {
      finish();
    }
    return () => { cancelled = true; };
  }, [ctxLoading, user, profile, testMode]);

  if (ctxLoading || loading) {
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
          <Card className="border-border bg-card">
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
                onClick={logoutToLogin}
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
  const canInvite = role === 'student';
  const canCreateSchool = role === 'pending' || role === 'admin';

  const handleJoined = (data) => {
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
          <h1 className="text-2xl font-semibold text-foreground">Add your school or club</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Optional — you can use BlockWard without one. Schools, clubs, academies, dojos and teams can all verify your achievements.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            A teacher? Ask your administrator for a staff invite or join code.
          </p>
        </div>

        <div className="space-y-4">
          {/* 1 — Join code: the fastest path, first */}
          <CodeJoinCard onJoined={handleJoined} />

          {/* 2 — Search for your organisation, request to join */}
          {canSearch ? (
            <SchoolSearchCard />
          ) : (
            <Card className="border-border bg-card">
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

          {/* 3 — Invite an organisation that isn't on BlockWard yet */}
          {canInvite && <InviteOrganisationCard />}

          {/* 4 — Create a new school: admin path, unchanged */}
          {canCreateSchool && (
            <Card className="border-border bg-card">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Setting up a new school or organisation?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You'll be the administrator. New schools and organisations start unverified.
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

        {/* Never trap anyone on this page — students can always come back later */}
        {role === 'student' && (
          <button
            onClick={() => { window.location.href = createPageUrl('StudentDashboard'); }}
            className="mx-auto mt-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            I'll do this later <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
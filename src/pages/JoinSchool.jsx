import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSchool } from '@/lib/SchoolContext';
import { toLogin, logoutToLogin } from '@/lib/authRedirectGuard';
import { Building2, Plus, Clock, GraduationCap, Users, ArrowRight, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
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
  const [resending, setResending] = useState(false);
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

  // Re-nudge the school's administrators (48-hour cooldown enforced server-side).
  const handleResend = async () => {
    setResending(true);
    try {
      const res = await base44.functions.invoke('resendStaffJoinRequest', {});
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not resend your request');
      toast.success(`Request re-sent to ${res.data.school_name ? res.data.school_name : 'your organisation'}'s administrators`);
      setPendingMembership((prev) => ({ ...(prev || {}), last_reminder_at: res.data.resent_at }));
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setResending(false);
    }
  };

  if (ctxLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  // A teacher awaiting approval — the holding screen names the school they
  // applied to, when they applied, and offers a resend after 48 hours.
  if (pendingMembership) {
    const schoolName = pendingMembership.school_name || 'your organisation';
    const requestedAt = pendingMembership.requested_at;
    const lastContact = pendingMembership.last_reminder_at || pendingMembership.requested_at;
    const canResend = lastContact && (Date.now() - new Date(lastContact).getTime() > 48 * 60 * 60 * 1000);
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <Card className="border-border bg-card">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mb-5">
                <Clock className="h-8 w-8 text-warning" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Awaiting approval</h2>
              <p className="text-sm text-muted-foreground mb-2">
                You applied to join <span className="text-foreground font-medium">{schoolName}</span>
                {requestedAt && (
                  <>
                    {' '}on {new Date(requestedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </>
                )}
                . The administrators have been notified and will review your request.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Until they approve you, you can't sign off achievements, view student data, take attendance or issue points.
                This screen updates automatically once you're approved.
              </p>
              {canResend ? (
                <Button onClick={handleResend} disabled={resending} className="w-full mb-2">
                  {resending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {resending ? 'Sending…' : 'Resend request to administrators'}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground mb-6">
                  If your request is taking a while, you can resend it 48 hours after applying.
                </p>
              )}
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
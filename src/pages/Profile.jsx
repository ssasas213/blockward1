import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Wallet, Copy, Check, Palette, Sparkles, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/loading-skeleton';
import NotificationPreferences from '@/components/notifications/NotificationPreferences';
import ProfileHeader from '@/components/profile/ProfileHeader';
import EditProfileForm from '@/components/profile/EditProfileForm';
import PublicProfileSettings from '@/components/profile/PublicProfileSettings';
import PublicProfileLinkCard from '@/components/profile/PublicProfileLinkCard';
import ProfileStats from '@/components/profile/ProfileStats';
import ProfileInsightsCard from '@/components/profile/ProfileInsightsCard';
import SecuritySection from '@/components/profile/SecuritySection';
import SignatureProfileSection from '@/components/profile/SignatureProfileSection';
import SchoolMembershipSection from '@/components/profile/SchoolMembershipSection';
import AppearanceSettings from '@/components/profile/AppearanceSettings';
import AccountSection from '@/components/profile/AccountSection';
import ProfileErrorBoundary from '@/components/profile/ProfileErrorBoundary';
import { useSchool } from '@/lib/SchoolContext';
import { resetTour } from '@/lib/tour';

function ProfileContent() {
  // ── Identity: SchoolContext owns it (auth.me + UserProfile, fetched ONCE
  // per session). This page performs ZERO identity requests of its own —
  // it renders straight from the context, and every save calls refresh()
  // so the whole app re-renders from the same source of truth.
  const {
    user: ctxUser, profile: ctxProfile, effectiveProfile,
    activeSchool, loading, testMode, refresh,
  } = useSchool();

  const isTest = !!testMode?.isTestSuperUser;
  const controllerEmail = ctxUser?.email;
  // In Test Mode the page shows the active persona's profile, not the
  // controller's.
  const user = isTest && testMode.effectiveEmail ? { ...ctxUser, email: testMode.effectiveEmail } : ctxUser;
  const profile = isTest ? (effectiveProfile || ctxProfile) : ctxProfile;
  const school = isTest ? (testMode.testSchool || null) : activeSchool;

  const [copiedWallet, setCopiedWallet] = useState(false);

  const copyWallet = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address);
      setCopiedWallet(true);
      toast.success('Wallet address copied');
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  // The context is still resolving the session identity (first paint of the
  // app) — skeleton shapes mirror the real sections.
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <Card className="shadow-sm text-center">
          <CardContent className="py-8">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <p className="font-medium text-foreground">You are not logged in.</p>
            <p className="text-sm text-muted-foreground mt-1">Please sign in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const missingFields = [];
  if (!profile?.first_name) missingFields.push('First name');
  if (!profile?.last_name) missingFields.push('Last name');
  if (profile?.user_type === 'student' && !profile?.parent_email) missingFields.push('Parent email');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="My Profile" description="Manage your account, contact details and integrations" />

      {isTest && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <FlaskConical className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Test Mode Details</p>
            <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
              <p>Simulating: <span className="font-medium text-foreground">{testMode.effectiveName}</span> ({testMode.activePersona})</p>
              <p>Controller: <span className="font-mono text-foreground">{controllerEmail}</span></p>
              <p>School: <span className="font-medium text-foreground">{testMode.testSchool?.name}</span></p>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-2">
              This profile reflects the simulated user. The controller identity above is kept separate for auditing.
            </p>
          </div>
        </div>
      )}

      {missingFields.length > 0 && (
        <div className="flex items-start gap-3 p-3 bg-warning/5 border border-warning/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Your profile is incomplete</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Missing: {missingFields.join(', ')}. Please fill in the fields below.
            </p>
          </div>
        </div>
      )}

      {/* Public profile link — claim it or share it */}
      {profile?.user_type === 'student' && (
        <PublicProfileLinkCard profile={profile} onSaved={refresh} />
      )}

      {/* User Info */}
      {profile ? (
        <ProfileHeader profile={profile} user={user} school={school} />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="py-8 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">No profile record found.</p>
            <p className="text-sm text-muted-foreground mt-1">Please complete your profile below.</p>
          </CardContent>
        </Card>
      )}

      {/* School Membership */}
      {profile && (
        <SchoolMembershipSection profile={profile} user={user} school={school} onRefresh={refresh} />
      )}

      {/* Edit Profile Form (includes profile picture uploader) */}
      <EditProfileForm profile={profile} onSaved={refresh} />

      {/* Public profile customisation — handle, bio, banner, theme, links, live preview */}
      {profile?.user_type === 'student' && (
        <PublicProfileSettings profile={profile} onSaved={refresh} />
      )}

      {/* Digital Custodian Status */}
      <ProfileStats profile={profile} userEmail={user?.email} />

      {/* Public profile insights + share feedback — students only */}
      {profile?.user_type === 'student' && (
        <ProfileInsightsCard profile={profile} userEmail={user?.email} />
      )}

      {/* Signature Profile (teacher/admin only) */}
      <SignatureProfileSection userEmail={user?.email} userRole={profile?.user_type} />

      {/* Blockchain Wallet */}
      {profile?.wallet_address && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Wallet className="h-4 w-4 text-primary" /> Blockchain Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Wallet Address (Polygon)</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-sm font-mono text-foreground truncate">{profile.wallet_address}</code>
                <Button variant="outline" size="sm" onClick={copyWallet}>
                  {copiedWallet ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {profile.blockchain_role && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-muted-foreground border-border">On-chain: {profile.blockchain_role}</Badge>
                  {profile.user_type === 'teacher' && (
                    <Badge variant="outline" className={profile.can_issue_blockwards ? 'text-success border-success/30 bg-success/5' : 'text-warning border-warning/30 bg-warning/5'}>
                      Minting: {profile.can_issue_blockwards ? 'Enabled' : 'Disabled'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {profile.user_type === 'student' && 'Your wallet can only receive BlockWards.'}
                  {profile.user_type === 'teacher' && 'Your wallet can submit achievements for approval.'}
                  {profile.user_type === 'admin' && 'You have administrative control over role assignments.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Points Summary — students only */}
      {profile?.user_type === 'student' && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Achievement Points" value={profile.total_achievement_points || 0} />
          <StatCard label="Behaviour Points" value={profile.total_behaviour_points || 0} />
        </div>
      )}

      {/* Preferences — Appearance + Notifications */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Palette className="h-4 w-4 text-primary" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AppearanceSettings profile={profile} onPreferenceChange={() => refresh()} />
          <div className="pt-4 border-t border-border">
            <NotificationPreferences userEmail={user?.email} />
          </div>
        </CardContent>
      </Card>

      {/* Help — Replay BlockWard Tour */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">BlockWard Tour</p>
              <p className="text-sm text-muted-foreground">Replay the guided introduction to BlockWard.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => resetTour()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Replay Tour
          </Button>
        </CardContent>
      </Card>

      {/* Account */}
      <AccountSection user={user} profile={profile} />

      <SecuritySection />
    </div>
  );
}

export default function Profile() {
  return (
    <ProfileErrorBoundary>
      <ProfileContent />
    </ProfileErrorBoundary>
  );
}
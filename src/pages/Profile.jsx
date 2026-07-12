import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2, RefreshCw, Bell, Wallet, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/loading-skeleton';
import NotificationPreferences from '@/components/notifications/NotificationPreferences';
import ProfileHeader from '@/components/profile/ProfileHeader';
import EditProfileForm from '@/components/profile/EditProfileForm';
import ProfileStats from '@/components/profile/ProfileStats';
import SecuritySection from '@/components/profile/SecuritySection';
import SignatureProfileSection from '@/components/profile/SignatureProfileSection';
import ProfileErrorBoundary from '@/components/profile/ProfileErrorBoundary';

function ProfileContent() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (!currentUser) { setLoading(false); return; }

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0] || null;
      setProfile(p);

      if (p?.school_id) {
        try {
          const schools = await base44.entities.School.filter({ id: p.school_id });
          if (schools.length) setSchool(schools[0]);
        } catch (_) {}
      }
    } catch (e) {
      console.error('[Profile] Load failed:', e?.message || e);
      setError(e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const copyWallet = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address);
      setCopiedWallet(true);
      toast.success('Wallet address copied');
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

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

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <Card className="shadow-sm text-center">
          <CardContent className="py-8">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <p className="font-medium text-foreground mb-1">Unable to load profile</p>
            <p className="text-sm text-muted-foreground mb-2">{error}</p>
            <p className="text-xs text-muted-foreground mb-4">Please refresh or contact your administrator.</p>
            <Button onClick={load} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Try Again
            </Button>
          </CardContent>
        </Card>
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

      {/* Digital Custodian Status */}
      <ProfileStats profile={profile} userEmail={user?.email} />

      {/* Edit Profile Form */}
      <EditProfileForm profile={profile} onSaved={load} />

      {/* Signature Profile (teacher/admin only) */}
      <SignatureProfileSection userEmail={user?.email} userRole={profile?.user_type} />

      {/* Blockchain Wallet */}
      {profile?.wallet_address && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Blockchain Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
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
                  <Badge variant="outline">On-chain: {profile.blockchain_role}</Badge>
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

      {/* Notification Preferences */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationPreferences userEmail={user?.email} />
        </CardContent>
      </Card>

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
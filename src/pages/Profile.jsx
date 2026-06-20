import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Wallet, Copy, Check, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import NotificationPreferences from '@/components/notifications/NotificationPreferences';
import ProfileHeader from '@/components/profile/ProfileHeader';
import EditProfileForm from '@/components/profile/EditProfileForm';
import ProfileStats from '@/components/profile/ProfileStats';
import GoogleIntegrationStatus from '@/components/profile/GoogleIntegrationStatus';
import SecuritySection from '@/components/profile/SecuritySection';
import SignatureProfileSection from '@/components/profile/SignatureProfileSection';
import DriveVaultSection from '@/components/profile/DriveVaultSection';
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

      if (!currentUser) {
        setLoading(false);
        return;
      }

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
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        <p className="text-sm text-slate-500">Loading your profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center p-8 bg-red-50 border border-red-200 rounded-2xl">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <p className="font-semibold text-red-700 mb-2">Unable to load profile</p>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <p className="text-xs text-red-500 mb-4">Please refresh or contact your administrator.</p>
        <Button onClick={load} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="font-semibold text-slate-700">You are not logged in.</p>
        <p className="text-sm text-slate-500 mt-1">Please sign in to view your profile.</p>
      </div>
    );
  }

  const missingFields = [];
  if (!profile?.first_name) missingFields.push('First name');
  if (!profile?.last_name) missingFields.push('Last name');
  if (profile?.user_type === 'student' && !profile?.parent_email) missingFields.push('Parent email');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your account, contact details and integrations</p>
      </div>

      {missingFields.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Your profile is incomplete</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Missing: {missingFields.join(', ')}. Please fill in the fields below.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1 — User Info / Header */}
      {profile ? (
        <ProfileHeader profile={profile} user={user} school={school} />
      ) : (
        <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
          <p className="font-medium">No profile record found. Please complete your profile below.</p>
        </div>
      )}

      {/* SECTION 4 — Digital Custodian Status */}
      <ProfileStats profile={profile} userEmail={user?.email} />

      {/* Edit Profile Form */}
      <EditProfileForm profile={profile} onSaved={load} />

      {/* SECTION 2 — Digital Signature Profile (teacher/admin only) */}
      <SignatureProfileSection userEmail={user?.email} userRole={profile?.user_type} />

      {/* SECTION 3 — Google Drive Connection */}
      <GoogleIntegrationStatus />
      <DriveVaultSection userEmail={user?.email} userType={profile?.user_type} />

      {/* Blockchain Wallet */}
      {profile?.wallet_address && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Blockchain Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Wallet Address (Polygon)</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-sm font-mono text-slate-700 truncate">{profile.wallet_address}</code>
                <Button variant="outline" size="sm" onClick={copyWallet}>
                  {copiedWallet ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {profile.blockchain_role && (
              <div className="p-3 bg-violet-50 rounded-xl border border-violet-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-violet-100 text-violet-700 border-0">On-chain: {profile.blockchain_role}</Badge>
                  {profile.user_type === 'teacher' && (
                    <Badge className={profile.can_issue_blockwards ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-amber-100 text-amber-700 border-0'}>
                      Minting: {profile.can_issue_blockwards ? 'Enabled' : 'Disabled'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-violet-600 mt-2">
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
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Points Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl text-center border border-green-100">
                <p className="text-sm text-green-600 font-medium">Achievement Points</p>
                <p className="text-4xl font-bold text-green-700 mt-2">{profile.total_achievement_points || 0}</p>
              </div>
              <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl text-center border border-amber-100">
                <p className="text-sm text-amber-600 font-medium">Behaviour Points</p>
                <p className="text-4xl font-bold text-amber-700 mt-2">{profile.total_behaviour_points || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Preferences */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
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
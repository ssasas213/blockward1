import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Wallet, Copy, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import NotificationPreferences from '@/components/notifications/NotificationPreferences';
import ProfileHeader from '@/components/profile/ProfileHeader';
import EditProfileForm from '@/components/profile/EditProfileForm';
import ProfileStats from '@/components/profile/ProfileStats';
import GoogleIntegrationStatus from '@/components/profile/GoogleIntegrationStatus';
import SecuritySection from '@/components/profile/SecuritySection';

function ProfileContent() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (!currentUser) return;

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0] || null;
      setProfile(p);

      if (p?.school_id) {
        const schools = await base44.entities.School.filter({ id: p.school_id });
        if (schools.length) setSchool(schools[0]);
      }
    } catch (e) {
      // not authenticated
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="max-w-lg mx-auto mt-16 text-center p-8 bg-slate-50 rounded-2xl">
      <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
      <p className="font-semibold text-slate-700">You are not logged in.</p>
    </div>
  );

  // Missing profile warning
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

      {/* Missing fields warning */}
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

      {/* Profile header card */}
      {profile ? (
        <ProfileHeader profile={profile} user={user} school={school} />
      ) : (
        <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
          <p className="font-medium">No profile found. Please complete your profile below.</p>
        </div>
      )}

      {/* Digital Custodian Stats */}
      <ProfileStats profile={profile} userEmail={user?.email} />

      {/* Edit Profile Form */}
      <EditProfileForm profile={profile} onSaved={load} />

      {/* Google Integrations */}
      <GoogleIntegrationStatus />

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
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-100 text-violet-700 border-0">On-chain: {profile.blockchain_role}</Badge>
                  {profile.user_type === 'teacher' && (
                    <Badge className={profile.can_issue_blockwards ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-amber-100 text-amber-700 border-0'}>
                      Minting: {profile.can_issue_blockwards ? 'Enabled' : 'Disabled'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-violet-600 mt-2">
                  {profile.user_type === 'student' && 'Your wallet can only receive BlockWards.'}
                  {profile.user_type === 'teacher' && 'Your wallet can mint BlockWards to students.'}
                  {profile.user_type === 'admin' && 'You have administrative control over role assignments.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Points Summary (students) */}
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

      {/* Security */}
      <SecuritySection />
    </div>
  );
}

export default function Profile() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
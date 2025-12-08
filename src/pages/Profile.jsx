import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, Mail, Shield, Wallet, School, 
  Save, Loader2, Copy, Check, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    department: '',
    grade_level: '',
    student_id: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      if (profiles.length > 0) {
        const userProfile = profiles[0];
        setProfile(userProfile);
        setFormData({
          first_name: userProfile.first_name || '',
          last_name: userProfile.last_name || '',
          department: userProfile.department || '',
          grade_level: userProfile.grade_level || '',
          student_id: userProfile.student_id || ''
        });

        if (userProfile.school_id) {
          const schools = await base44.entities.School.filter({ id: userProfile.school_id });
          if (schools.length > 0) setSchool(schools[0]);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.UserProfile.update(profile.id, formData);
      toast.success('Profile updated successfully');
      loadProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const copyWalletAddress = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  const roleColors = {
    admin: 'bg-rose-100 text-rose-700 border-rose-200',
    teacher: 'bg-violet-100 text-violet-700 border-violet-200',
    student: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  const roleLabels = {
    admin: 'Administrator',
    teacher: 'Teacher',
    student: 'Student'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className={`h-24 bg-gradient-to-r ${
          profile?.user_type === 'admin' ? 'from-rose-500 to-orange-500' :
          profile?.user_type === 'teacher' ? 'from-violet-500 to-purple-500' :
          'from-blue-500 to-cyan-500'
        }`} />
        <CardContent className="relative px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 mb-6">
            <div className={`h-24 w-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-xl ${
              profile?.user_type === 'admin' ? 'bg-rose-500' :
              profile?.user_type === 'teacher' ? 'bg-violet-500' :
              'bg-blue-500'
            }`}>
              {profile?.first_name?.[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={roleColors[profile?.user_type]}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabels[profile?.user_type]}
                </Badge>
                {school && (
                  <Badge variant="outline">
                    <School className="h-3 w-3 mr-1" />
                    {school.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="bg-slate-50" />
            </div>
            {profile?.user_type === 'teacher' && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. Mathematics"
                />
              </div>
            )}
            {profile?.user_type === 'student' && (
              <>
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grade/Year Level</Label>
                  <Input
                    value={formData.grade_level}
                    onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-6">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blockchain Wallet */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Blockchain Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-500 mb-2">Wallet Address (Polygon)</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-sm font-mono text-slate-700 truncate">
                {profile?.wallet_address}
              </code>
              <Button variant="outline" size="sm" onClick={copyWalletAddress}>
                {copiedWallet ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
            <h4 className="font-semibold text-violet-900 mb-2">Blockchain Role: {profile?.blockchain_role}</h4>
            <p className="text-sm text-violet-700">
              {profile?.user_type === 'student' && 
                "Your wallet can only receive BlockWards. You cannot send, transfer, or trade any tokens."}
              {profile?.user_type === 'teacher' && 
                "Your wallet can only mint BlockWards to students. You cannot hold or transfer tokens."}
              {profile?.user_type === 'admin' && 
                "You have administrative control over role assignments and can revoke BlockWards if needed."}
            </p>
          </div>

          {profile?.user_type === 'teacher' && (
            <div className={`p-4 rounded-xl border ${profile?.can_issue_blockwards ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <h4 className={`font-semibold ${profile?.can_issue_blockwards ? 'text-green-900' : 'text-amber-900'}`}>
                BlockWard Minting: {profile?.can_issue_blockwards ? 'Enabled' : 'Disabled'}
              </h4>
              <p className={`text-sm mt-1 ${profile?.can_issue_blockwards ? 'text-green-700' : 'text-amber-700'}`}>
                {profile?.can_issue_blockwards 
                  ? "You are authorized to mint BlockWards to students." 
                  : "Contact your admin to enable BlockWard minting permission."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Points Summary (Students Only) */}
      {profile?.user_type === 'student' && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Points Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <p className="text-sm text-green-600">Achievement Points</p>
                <p className="text-3xl font-bold text-green-700">{profile?.total_achievement_points || 0}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl text-center">
                <p className="text-sm text-amber-600">Behaviour Points</p>
                <p className="text-3xl font-bold text-amber-700">{profile?.total_behaviour_points || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Shield, Plus, LogIn, Rocket, ArrowRight, Loader2, Check,
} from 'lucide-react';
import { toast } from 'sonner';

const ORG_TYPES = [
  { value: 'school', label: 'School' },
  { value: 'sports_club', label: 'Sports Club' },
  { value: 'martial_arts_academy', label: 'Martial Arts Academy' },
  { value: 'chess_club', label: 'Chess Club' },
  { value: 'competition_organizer', label: 'Competition Organizer' },
  { value: 'training_provider', label: 'Training Provider' },
  { value: 'music_academy', label: 'Music Academy' },
  { value: 'debate_organization', label: 'Debate Organization' },
  { value: 'stem_competition', label: 'STEM Competition' },
  { value: 'corporate_training', label: 'Corporate Training' },
  { value: 'other', label: 'Other' },
];

export default function SchoolSetup() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '', country: '', city: '', org_type: 'school',
    website: '', contact_email: '', admin_title: '', logo_url: '',
  });

  // Join-by-code state
  const [joinCode, setJoinCode] = useState('');
  const [joinResult, setJoinResult] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'join') setMode('join');
  }, []);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          const p = profiles[0];
          setProfile(p);
          if (p.user_type === 'admin' && p.school_id) {
            window.location.href = createPageUrl('AdminDashboard');
            return;
          }
        }
      }
    } catch (error) {
      // not authenticated
    } finally {
      setLoading(false);
    }
  };

  const ensureProfile = async () => {
    if (profile) return profile;
    const nameParts = (user.full_name || user.email || 'Admin').split(' ');
    const p = await base44.entities.UserProfile.create({
      user_email: user.email,
      user_type: 'admin',
      first_name: nameParts[0] || 'Admin',
      last_name: nameParts.slice(1).join(' ') || '',
      admin_level: 'super_admin',
      status: 'active',
    });
    setProfile(p);
    return p;
  };

  const handleLogoUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, logo_url: file_url }));
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error('Failed to upload logo');
    }
  };

  const generateCode = (name) => {
    return `${name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}-${Math.random().toString(36).toUpperCase().slice(2, 6)}`;
  };

  const handleCreateSchool = async () => {
    if (!form.name.trim()) { toast.error('Please enter a school name'); return; }
    if (!form.contact_email.trim()) { toast.error('Please enter a contact email'); return; }

    setSubmitting(true);
    try {
      const currentProfile = await ensureProfile();
      const code = generateCode(form.name);
      const schoolCode = `${form.name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().slice(0, 12)}-${new Date().getFullYear()}`;

      // 1. Create the School
      const school = await base44.entities.School.create({
        name: form.name.trim(),
        code,
        school_code: schoolCode,
        org_type: form.org_type,
        country: form.country.trim() || undefined,
        city: form.city.trim() || undefined,
        website: form.website.trim() || undefined,
        contact_email: form.contact_email.trim(),
        logo_url: form.logo_url || undefined,
        admin_email: user.email,
        admin_title: form.admin_title.trim() || undefined,
        address: [form.city, form.country].filter(Boolean).join(', ') || undefined,
        status: 'active',
        created_by: user.email,
      });

      // 2. Create AdminSchoolMembership (owner role)
      await base44.entities.AdminSchoolMembership.create({
        admin_user_id: currentProfile.id,
        admin_email: user.email,
        admin_name: `${currentProfile.first_name} ${currentProfile.last_name}`,
        school_id: school.id,
        school_name: school.name,
        role: 'owner',
        status: 'active',
        is_primary: true,
        joined_at: new Date().toISOString(),
      });

      // 3. Create a SchoolCode for admin joining
      await base44.entities.SchoolCode.create({
        school_id: school.id,
        school_name: school.name,
        code: schoolCode,
        role_type: 'admin',
        status: 'active',
        created_by: user.email,
        label: 'Default Admin Code',
      });

      // 4. Set the new school as active school
      await base44.entities.UserProfile.update(currentProfile.id, {
        school_id: school.id,
        active_school_id: school.id,
        admin_level: currentProfile.admin_level || 'super_admin',
      });

      toast.success(`${school.name} created successfully`);
      window.location.href = createPageUrl('AdminDashboard');
    } catch (error) {
      console.error('Error creating school:', error);
      toast.error(error.message || 'Failed to create school');
      setSubmitting(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) { toast.error('Please enter a school code'); return; }
    setSubmitting(true);
    setJoinResult(null);

    try {
      const currentProfile = await ensureProfile();

      // 1. Look up the code
      const codes = await base44.entities.SchoolCode.filter({ code: joinCode.trim() });
      if (codes.length === 0) {
        setJoinResult({ error: 'Invalid code. No school found with that code.' });
        setSubmitting(false);
        return;
      }

      const schoolCode = codes[0];

      // 2. Check code status
      if (schoolCode.status === 'disabled') {
        setJoinResult({ error: 'This code has been disabled. Contact the school administrator.' });
        setSubmitting(false);
        return;
      }

      // 3. Check expiry
      if (schoolCode.expires_at && new Date(schoolCode.expires_at) < new Date()) {
        setJoinResult({ error: 'This code has expired. Contact the school administrator.' });
        setSubmitting(false);
        return;
      }

      // 4. Check role type validity
      if (schoolCode.role_type !== 'admin' && schoolCode.role_type !== 'all') {
        setJoinResult({ error: 'This code is not valid for admin access.' });
        setSubmitting(false);
        return;
      }

      // 5. Check max uses
      if (schoolCode.max_uses && schoolCode.use_count >= schoolCode.max_uses) {
        setJoinResult({ error: 'This code has reached its maximum uses.' });
        setSubmitting(false);
        return;
      }

      // 6. Check for duplicate memberships
      const existing = await base44.entities.AdminSchoolMembership.filter({
        admin_email: user.email,
        school_id: schoolCode.school_id,
      });

      if (existing.length > 0) {
        const mem = existing[0];
        if (mem.status === 'active') {
          setJoinResult({ error: 'You are already linked to this school.' });
        } else if (mem.status === 'pending') {
          setJoinResult({ error: 'You already have a pending join request for this school.' });
        } else {
          setJoinResult({ error: 'You already have a membership record for this school.' });
        }
        setSubmitting(false);
        return;
      }

      // 7. Create the membership — immediate access for admin codes
      const membership = await base44.entities.AdminSchoolMembership.create({
        admin_user_id: currentProfile.id,
        admin_email: user.email,
        admin_name: `${currentProfile.first_name} ${currentProfile.last_name}`,
        school_id: schoolCode.school_id,
        school_name: schoolCode.school_name,
        role: 'admin',
        status: 'active',
        is_primary: !currentProfile.school_id,
        joined_at: new Date().toISOString(),
      });

      // 8. Set as active school if user has no school yet
      if (!currentProfile.school_id) {
        await base44.entities.UserProfile.update(currentProfile.id, {
          school_id: schoolCode.school_id,
          active_school_id: schoolCode.school_id,
        });
      }

      // 9. Increment use count
      await base44.entities.SchoolCode.update(schoolCode.id, {
        use_count: (schoolCode.use_count || 0) + 1,
      });

      setJoinResult({ success: true, schoolName: schoolCode.school_name });
      toast.success(`Successfully joined ${schoolCode.school_name}`);

      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = createPageUrl('AdminDashboard');
      }, 1500);
    } catch (error) {
      console.error('Error joining school:', error);
      setJoinResult({ error: error.message || 'Failed to join school' });
      setSubmitting(false);
    }
  };

  const handleDemoMode = () => {
    window.location.href = createPageUrl('AdminDashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = '/Login';
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Set up your school</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Choose how you'd like to get started with BlockWard
          </p>
        </div>

        {mode === null && (
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              onClick={() => setMode('create')}
              className="group p-6 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">Create a New School</h3>
              <p className="text-xs text-muted-foreground mt-1">Set up your organisation from scratch</p>
            </button>

            <button
              onClick={() => setMode('join')}
              className="group p-6 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <LogIn className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">Join an Existing School</h3>
              <p className="text-xs text-muted-foreground mt-1">Enter a school code to join</p>
            </button>

            <button
              onClick={handleDemoMode}
              className="group p-6 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">Continue in Demo Mode</h3>
              <p className="text-xs text-muted-foreground mt-1">Explore the platform without a school</p>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg">Create a New School</CardTitle>
              <CardDescription>Enter your organisation details below</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>School Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Dubai International Academy"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    placeholder="e.g. United Arab Emirates"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Dubai"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>School Type</Label>
                  <select
                    value={form.org_type}
                    onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Contact Email *</Label>
                  <Input
                    type="email"
                    value={form.contact_email}
                    onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                    placeholder="admin@school.edu"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Administrator Title</Label>
                  <Input
                    value={form.admin_title}
                    onChange={e => setForm(f => ({ ...f, admin_title: e.target.value }))}
                    placeholder="e.g. Principal, Director"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website (optional)</Label>
                  <Input
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>School Logo (optional)</Label>
                <div className="flex items-center gap-3">
                  {form.logo_url && (
                    <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover border border-border" />
                  )}
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center justify-center h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm hover:bg-primary/10 hover:border-primary/50 transition-all">
                      Upload Logo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setMode(null)}>Back</Button>
                <Button onClick={handleCreateSchool} disabled={submitting} className="flex-1">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Create School <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'join' && (
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg">Join an Existing School</CardTitle>
              <CardDescription>Enter the school code provided by the school administrator</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>School Code</Label>
                <Input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                  placeholder="e.g. DUBAIINT-2026"
                  className="font-mono uppercase"
                />
              </div>

              {joinResult?.error && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                  {joinResult.error}
                </div>
              )}

              {joinResult?.success && (
                <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-sm text-success-foreground flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Successfully joined {joinResult.schoolName}. Redirecting…
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setMode(null)}>Back</Button>
                <Button onClick={handleJoinByCode} disabled={submitting} className="flex-1">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Join School <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
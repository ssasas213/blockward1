import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Shield, Plus, LogIn, Rocket, ArrowRight, Loader2, Building2, Search, Check, Clock,
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
  const [mode, setMode] = useState(null); // null = choose, 'create', 'join', 'demo'
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    name: '', country: '', city: '', org_type: 'school',
    website: '', admin_title: '', logo_url: '',
  });

  // Join search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requestedSchools, setRequestedSchools] = useState(new Set());

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
          // If admin already has a school, redirect to dashboard
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

  const handleLogoUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, logo_url: file_url }));
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error('Failed to upload logo');
    }
  };

  const handleCreateSchool = async () => {
    if (!form.name.trim()) {
      toast.error('Please enter a school name');
      return;
    }
    setSubmitting(true);
    try {
      const code = `${form.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-4)}`;
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
        logo_url: form.logo_url || undefined,
        admin_email: user.email,
        admin_title: form.admin_title.trim() || undefined,
        address: [form.city, form.country].filter(Boolean).join(', ') || undefined,
      });

      // 2. Create AdminSchoolMembership (owner role)
      await base44.entities.AdminSchoolMembership.create({
        admin_user_id: profile.id,
        admin_email: user.email,
        admin_name: `${profile.first_name} ${profile.last_name}`,
        school_id: school.id,
        school_name: school.name,
        role: 'owner',
        status: 'active',
        is_primary: true,
        joined_at: new Date().toISOString(),
      });

      // 3. Update UserProfile with the new school_id
      await base44.entities.UserProfile.update(profile.id, {
        school_id: school.id,
        active_school_id: school.id,
        admin_level: profile.admin_level || 'super_admin',
      });

      toast.success(`${school.name} created successfully`);
      // Redirect to dashboard
      window.location.href = createPageUrl('AdminDashboard');
    } catch (error) {
      console.error('Error creating school:', error);
      toast.error(error.message || 'Failed to create school');
      setSubmitting(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      // Search by name — RLS allows admins to read schools they own;
      // for join, we use a broader search that returns public school info
      const results = await base44.entities.School.filter({});
      const filtered = results.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleRequestAccess = async (school) => {
    setSubmitting(true);
    try {
      // Create a pending membership request
      await base44.entities.AdminSchoolMembership.create({
        admin_user_id: profile.id,
        admin_email: user.email,
        admin_name: `${profile.first_name} ${profile.last_name}`,
        school_id: school.id,
        school_name: school.name,
        role: 'admin',
        status: 'pending',
        joined_at: new Date().toISOString(),
      });
      setRequestedSchools(prev => new Set([...prev, school.id]));
      toast.success(`Access requested for ${school.name}. You'll be notified when approved.`);
    } catch (error) {
      toast.error('Failed to request access');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoMode = () => {
    // Continue without a school — redirect to dashboard which will show empty state
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
        {/* Logo */}
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
              <p className="text-xs text-muted-foreground mt-1">Request access to a school already on BlockWard</p>
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
                  <Label>Administrator Title</Label>
                  <Input
                    value={form.admin_title}
                    onChange={e => setForm(f => ({ ...f, admin_title: e.target.value }))}
                    placeholder="e.g. Principal, Director"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Website (optional)</Label>
                <Input
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="https://"
                />
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
              <CardDescription>Search for a school and request access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by school name…"
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching} variant="outline">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(school => (
                    <div key={school.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {school.logo_url ? (
                            <img src={school.logo_url} alt="" className="h-9 w-9 rounded-md object-cover" />
                          ) : (
                            <Building2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{school.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[school.city, school.country].filter(Boolean).join(', ') || school.org_type}
                          </p>
                        </div>
                      </div>
                      {requestedSchools.has(school.id) ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleRequestAccess(school)} disabled={submitting}>
                          Request Access
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No schools found matching "{searchQuery}"
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setMode(null)}>Back</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
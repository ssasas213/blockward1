import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/lib/SchoolContext';
import {
  Settings, Building2, Users, Shield, Loader2, Save, Upload, Crown, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import PermissionMatrix from '@/components/settings/PermissionMatrix';

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

const ROLE_LABELS = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  admin: 'Admin',
  reviewer: 'Reviewer',
};

import RoleGuard from '@/components/auth/RoleGuard';
export default function SystemSettings() { return <RoleGuard roles={['admin']}><SystemSettingsImpl/></RoleGuard>; }
function SystemSettingsImpl() {
  const { activeSchool, profile, refresh, loading: schoolLoading } = useSchool();
  const [form, setForm] = useState(null);
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const canEdit = activeSchool && (activeSchool.admin_email === profile?.user_email || profile?.admin_level === 'super_admin');

  useEffect(() => {
    if (activeSchool) {
      setForm({
        name: activeSchool.name || '',
        country: activeSchool.country || '',
        city: activeSchool.city || '',
        org_type: activeSchool.org_type || 'school',
        contact_email: activeSchool.contact_email || '',
        website: activeSchool.website || '',
        logo_url: activeSchool.logo_url || '',
        admin_title: activeSchool.admin_title || '',
      });
      loadMembers();
    }
  }, [activeSchool]);

  const loadMembers = async () => {
    if (!activeSchool) return;
    setLoadingMembers(true);
    try {
      const mems = await base44.entities.AdminSchoolMembership.filter({ school_id: activeSchool.id });
      // Sort: owners first, then by role
      mems.sort((a, b) => {
        const order = { owner: 0, super_admin: 1, admin: 2, reviewer: 3 };
        return (order[a.role] ?? 9) - (order[b.role] ?? 9);
      });
      setMembers(mems);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoadingMembers(false);
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

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('School name is required'); return; }
    setSaving(true);
    try {
      await base44.entities.School.update(activeSchool.id, {
        name: form.name.trim(),
        country: form.country.trim() || undefined,
        city: form.city.trim() || undefined,
        org_type: form.org_type,
        contact_email: form.contact_email.trim() || undefined,
        website: form.website.trim() || undefined,
        logo_url: form.logo_url || undefined,
        admin_title: form.admin_title.trim() || undefined,
        address: [form.city, form.country].filter(Boolean).join(', ') || undefined,
      });
      toast.success('School settings saved');
      refresh();
    } catch (error) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (schoolLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeSchool) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-lg font-medium text-foreground">No active school</p>
        <p className="text-sm text-muted-foreground mt-1">Create or join a school first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">School Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your school details and admin team</p>
      </div>

      {/* School Information */}
      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            School Information
          </CardTitle>
          <CardDescription>Update your school's basic details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>School Name</Label>
            <Input
              value={form?.name || ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              disabled={!canEdit}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={form?.country || ''}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form?.city || ''}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>School Type</Label>
              <select
                value={form?.org_type || 'school'}
                onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))}
                disabled={!canEdit}
                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
              >
                {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={form?.contact_email || ''}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={form?.website || ''}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                disabled={!canEdit}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label>Administrator Title</Label>
              <Input
                value={form?.admin_title || ''}
                onChange={e => setForm(f => ({ ...f, admin_title: e.target.value }))}
                disabled={!canEdit}
                placeholder="e.g. Principal"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>School Logo</Label>
            <div className="flex items-center gap-3">
              {form?.logo_url && (
                <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover border border-border" />
              )}
              {canEdit && (
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm hover:bg-primary/10 hover:border-primary/50 transition-all">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </div>

          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save Changes</>}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* School Status */}
      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            School Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={activeSchool.status === 'active' ? 'success' : 'destructive'}>
              {activeSchool.status || 'active'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">School Code</span>
            <span className="text-sm font-mono text-foreground">{activeSchool.school_code || activeSchool.code}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Created By</span>
            <span className="text-sm text-foreground">{activeSchool.created_by || activeSchool.admin_email}</span>
          </div>
        </CardContent>
      </Card>

      {/* Admin Team */}
      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Admin Team
          </CardTitle>
          <CardDescription>Current admins and their membership roles</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No admin members found.</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {m.role === 'owner' ? (
                        <Crown className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="text-sm font-medium text-primary">
                          {m.admin_name?.[0]?.toUpperCase() || m.admin_email?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.admin_name || m.admin_email}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.admin_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                      {ROLE_LABELS[m.role] || m.role}
                    </Badge>
                    <Badge variant={m.status === 'active' ? 'success' : 'outline'}>
                      {m.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PermissionMatrix />

      {!canEdit && (
        <p className="text-xs text-muted-foreground text-center">
          Only the school owner or super admin can edit these settings.
        </p>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Pencil, Check, X, Mail, Phone, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const RELATIONSHIP_LABELS = {
  mother: 'Mother',
  father: 'Father',
  guardian: 'Guardian',
  other: 'Other',
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ParentContactSection({ profile, userEmail, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    parent_name: profile?.parent_name || '',
    parent_email: profile?.parent_email || '',
    parent_phone: profile?.parent_phone || '',
    parent_relationship: profile?.parent_relationship || '',
  });

  const hasContact = profile?.parent_name || profile?.parent_email;

  const startEdit = () => {
    setForm({
      parent_name: profile?.parent_name || '',
      parent_email: profile?.parent_email || '',
      parent_phone: profile?.parent_phone || '',
      parent_relationship: profile?.parent_relationship || '',
    });
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    if (!form.parent_name.trim()) {
      toast.error('Please enter the parent/guardian name');
      return;
    }
    if (!form.parent_email.trim()) {
      toast.error('Please enter the parent/guardian email');
      return;
    }
    if (!isValidEmail(form.parent_email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!form.parent_relationship) {
      toast.error('Please select the relationship');
      return;
    }

    setSaving(true);
    try {
      // Security: only update own profile, identified by user_email match
      const profiles = await base44.entities.UserProfile.filter({ user_email: userEmail });
      if (!profiles.length) throw new Error('Profile not found');
      const ownProfile = profiles[0];

      await base44.entities.UserProfile.update(ownProfile.id, {
        parent_name: form.parent_name.trim(),
        parent_email: form.parent_email.trim().toLowerCase(),
        parent_phone: form.parent_phone.trim(),
        parent_relationship: form.parent_relationship,
        parent_contact_updated_at: new Date().toISOString(),
      });

      toast.success('Parent contact saved successfully');
      setEditing(false);
      if (onUpdated) onUpdated();
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Parent/Guardian Contact
        </CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {hasContact ? 'Edit' : 'Add'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={form.parent_name}
                  onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Relationship <span className="text-red-500">*</span></Label>
                <Select value={form.parent_relationship} onValueChange={v => setForm(f => ({ ...f, parent_relationship: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email Address <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={form.parent_email}
                  onChange={e => setForm(f => ({ ...f, parent_email: e.target.value }))}
                  placeholder="parent@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input
                  type="tel"
                  value={form.parent_phone}
                  onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))}
                  placeholder="+44 7700 000000"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Save Contact
              </Button>
            </div>
          </div>
        ) : hasContact ? (
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-lg flex-shrink-0">
                {(profile.parent_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">{profile.parent_name}</p>
                  {profile.parent_relationship && (
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                      {RELATIONSHIP_LABELS[profile.parent_relationship] || profile.parent_relationship}
                    </Badge>
                  )}
                </div>
                {profile.parent_email && (
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {profile.parent_email}
                  </div>
                )}
                {profile.parent_phone && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-sm text-slate-600">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {profile.parent_phone}
                  </div>
                )}
              </div>
            </div>
            {profile.parent_contact_updated_at && (
              <p className="text-xs text-slate-400">
                Last updated {format(new Date(profile.parent_contact_updated_at), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No parent/guardian contact added yet.</p>
            <p className="text-xs mt-1">Click "Add" to link your parent or guardian's contact details.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
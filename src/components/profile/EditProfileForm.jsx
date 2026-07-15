import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, Save, Loader2, BookOpen, GraduationCap, Users } from 'lucide-react';

export default function EditProfileForm({ profile, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    avatar_url: '',
    department: '',
    subjects: '',
    grade_level: '',
    student_id: '',
    parent_name: '',
    parent_email: '',
    parent_phone: '',
    parent_relationship: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        avatar_url: profile.avatar_url || '',
        department: profile.department || '',
        subjects: (profile.subjects || []).join(', '),
        grade_level: profile.grade_level || '',
        student_id: profile.student_id || '',
        parent_name: profile.parent_name || '',
        parent_email: profile.parent_email || '',
        parent_phone: profile.parent_phone || '',
        parent_relationship: profile.parent_relationship || '',
      });
    }
  }, [profile]);

  const save = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (profile?.user_type === 'student' && form.parent_email) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(form.parent_email)) {
        toast.error('Parent email is not valid');
        return;
      }
    }
    setSaving(true);
    try {
      const updateData = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        avatar_url: form.avatar_url.trim(),
      };
      if (profile?.user_type === 'teacher') {
        updateData.department = form.department;
        updateData.subjects = form.subjects.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (profile?.user_type === 'student') {
        updateData.grade_level = form.grade_level;
        updateData.student_id = form.student_id;
        updateData.parent_name = form.parent_name.trim();
        updateData.parent_email = form.parent_email.trim().toLowerCase();
        updateData.parent_phone = form.parent_phone.trim();
        updateData.parent_relationship = form.parent_relationship;
        if (form.parent_email) updateData.parent_contact_updated_at = new Date().toISOString();
      }
      await base44.entities.UserProfile.update(profile.id, updateData);
      toast.success('Profile saved successfully');
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, type = 'text', placeholder = '', hint) => (
    <div className="space-y-1.5">
      <Label className="text-foreground">{label}</Label>
      <Input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="bg-input/50 border-border text-foreground placeholder:text-muted-foreground/60"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <User className="h-4 w-4 text-primary" /> Edit Profile
        </CardTitle>
        <p className="text-sm text-muted-foreground">Update your personal information and contact details.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Basic info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('First Name *', 'first_name', 'text', 'First name')}
          {field('Last Name *', 'last_name', 'text', 'Last name')}
          {field('Avatar URL', 'avatar_url', 'url', 'https://...')}
        </div>

        {/* Teacher fields */}
        {profile?.user_type === 'teacher' && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teacher Details</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Department', 'department', 'text', 'e.g. Mathematics')}
              {field('Subjects', 'subjects', 'text', 'Math, Science', 'Add subjects separated by commas.')}
            </div>
          </div>
        )}

        {/* Student fields */}
        {profile?.user_type === 'student' && (
          <>
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student Details</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Student ID', 'student_id', 'text')}
                {field('Year / Grade Level', 'grade_level', 'text', 'e.g. Year 10')}
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parent / Guardian Contact</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Parent Name', 'parent_name', 'text', 'Full name')}
                {field('Parent Email', 'parent_email', 'email', 'parent@example.com')}
                {field('Parent Phone', 'parent_phone', 'tel', '+44 7700 000000')}
                <div className="space-y-1.5">
                  <Label className="text-foreground">Relationship</Label>
                  <Select value={form.parent_relationship} onValueChange={v => setForm(f => ({ ...f, parent_relationship: v }))}>
                    <SelectTrigger className="bg-input/50 border-border"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t border-border px-6 py-4">
        <Button
          onClick={save}
          disabled={saving}
          className="w-full sm:w-auto sm:ml-auto bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-glow"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
}
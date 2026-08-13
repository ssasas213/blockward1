import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield, Plus, LogIn, ArrowRight, ArrowLeft, Loader2, Check,
  Users, GraduationCap, Building2, Copy, AlertTriangle, Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import InvitePeopleModal from '@/components/invitations/InvitePeopleModal';

export default function SchoolSetup() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [inviteModal, setInviteModal] = useState({ open: false, role: 'teacher' });

  const [form, setForm] = useState({
    name: '', country: '', city: '', logo_url: '', contact_email: '',
  });

  const [joinCode, setJoinCode] = useState('');
  const [joinResult, setJoinResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (currentUser) setForm(f => ({ ...f, contact_email: currentUser.email }));
      } catch {
        window.location.href = '/Login';
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogoUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, logo_url: file_url }));
      toast.success('Logo uploaded');
    } catch {
      toast.error('Failed to upload logo');
    }
  };

  const handleCreateSchool = async () => {
    setSubmitting(true);
    try {
      const response = await base44.functions.invoke('setupSchool', {
        ...form,
        contact_email: form.contact_email || user.email,
        admin_full_name: user.full_name || '',
      });
      setResult(response.data);
      setMode('success');
      toast.success('School created!');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to create school');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) { toast.error('Please enter a school code'); return; }
    setSubmitting(true);
    setJoinResult(null);
    try {
      const response = await base44.functions.invoke('joinSchoolByCode', {
        code: joinCode.trim(), role_type: 'admin',
      });
      const data = response.data;
      if (data.status === 'pending') {
        setJoinResult({ pending: true, message: data.message, schoolName: data.school_name });
      } else {
        setJoinResult({ success: true, message: data.message, schoolName: data.school_name });
        setTimeout(() => { window.location.href = createPageUrl('AdminDashboard'); }, 2000);
      }
    } catch (error) {
      setJoinResult({ error: error.response?.data?.error || error.message || 'Failed to join school' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ===== SUCCESS / WELCOME SCREEN =====
  if (mode === 'success' && result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Your school is ready 🎉</h1>
            <p className="text-sm text-muted-foreground mt-2">Invite your team to start using BlockWard.</p>
          </div>

          <Card className="border-border bg-card/60 backdrop-blur-md mb-5">
            <CardContent className="p-5 flex items-center gap-4">
              {result.school.logo_url ? (
                <img src={result.school.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover border border-border" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-foreground">{result.school.name}</h2>
                <p className="text-xs text-muted-foreground">School workspace created</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-md mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Invite your team</CardTitle>
              <CardDescription>Send email invitations — they join instantly, no codes needed.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button onClick={() => setInviteModal({ open: true, role: 'teacher' })} className="h-auto py-3 flex-col gap-1">
                <Users className="h-5 w-5" />
                <span className="text-sm">Invite Teachers</span>
              </Button>
              <Button onClick={() => setInviteModal({ open: true, role: 'student' })} variant="outline" className="h-auto py-3 flex-col gap-1">
                <GraduationCap className="h-5 w-5" />
                <span className="text-sm">Invite Students</span>
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { window.location.href = createPageUrl('AdminDashboard'); }}>
              Skip for Now <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button className="flex-1" onClick={() => { window.location.href = createPageUrl('AdminDashboard'); }}>
              Go to Admin Dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          <InvitePeopleModal
            open={inviteModal.open}
            onOpenChange={(o) => setInviteModal({ open: o, role: inviteModal.role })}
            defaultRole={inviteModal.role}
            schoolId={result.school.id}
          />
        </div>
      </div>
    );
  }

  // ===== MODE SELECT =====
  if (mode === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Set up your school</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Create a new school workspace or join an existing one.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setMode('create')}
              className="group p-6 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 transition-all text-left card-hover"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">Create a School</h3>
              <p className="text-xs text-muted-foreground mt-1">Set up your organisation and invite your team</p>
            </button>

            <button
              onClick={() => setMode('join')}
              className="group p-6 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 transition-all text-left card-hover"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <LogIn className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">Join a School</h3>
              <p className="text-xs text-muted-foreground mt-1">Enter a school code to request access</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== JOIN MODE =====
  if (mode === 'join') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
        <div className="w-full max-w-md">
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Join an Existing School</CardTitle>
              <CardDescription>Enter the admin join code provided by the school owner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Admin Join Code</Label>
                <Input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                  placeholder="e.g. IHS-ADMIN-7K4P92"
                  className="font-mono uppercase"
                />
              </div>

              {joinResult?.error && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">{joinResult.error}</div>
              )}
              {joinResult?.pending && (
                <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-sm text-warning flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{joinResult.message}</span>
                </div>
              )}
              {joinResult?.success && (
                <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-sm text-success flex items-center gap-2">
                  <Check className="h-4 w-4" /> {joinResult.message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => { setMode(null); setJoinResult(null); }}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button onClick={handleJoinByCode} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Request Access <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===== CREATE MODE — SINGLE SCREEN =====
  const canSubmit = form.name.trim() && (form.contact_email || user?.email);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <div className="w-full max-w-xl">
        <Card className="border-border bg-card/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Create your school</CardTitle>
            <CardDescription>Just a few details to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>School Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dubai International Academy" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. United Arab Emirates" />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Dubai" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>School Logo (optional)</Label>
              <div className="flex items-center gap-3">
                {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover border border-border" />}
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm hover:bg-primary/10 hover:border-primary/50 transition-all">Upload Logo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setMode(null)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button onClick={handleCreateSchool} disabled={!canSubmit || submitting} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create School <Rocket className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
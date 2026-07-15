import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Shield, Plus, LogIn, ArrowRight, ArrowLeft, Loader2, Check,
  Users, GraduationCap, Building2, Copy, AlertTriangle, Rocket,
} from 'lucide-react';
import { toast } from 'sonner';

const SCHOOL_TYPES = [
  { value: 'primary_school', label: 'Primary School' },
  { value: 'secondary_school', label: 'Secondary School' },
  { value: 'sixth_form', label: 'Sixth Form' },
  { value: 'college', label: 'College' },
  { value: 'university', label: 'University' },
  { value: 'training_centre', label: 'Training Centre' },
  { value: 'other', label: 'Other' },
];

export default function SchoolSetup() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    name: '', country: '', city: '', school_type: 'primary_school',
    contact_email: '', logo_url: '', website: '', address: '', description: '', phone: '',
    admin_full_name: '', admin_job_title: '', admin_department: '', admin_phone: '',
  });

  const [joinCode, setJoinCode] = useState('');
  const [joinResult, setJoinResult] = useState(null);

  useEffect(() => {
    loadAuth();
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'join') setMode('join');
  }, []);

  const loadAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser) {
        setForm(f => ({
          ...f,
          contact_email: currentUser.email || '',
          admin_full_name: currentUser.full_name || '',
        }));
      }
    } catch {
      window.location.href = '/Login';
    } finally {
      setLoading(false);
    }
  };

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
      const response = await base44.functions.invoke('setupSchool', form);
      setResult(response.data);
      setMode('success');
      toast.success('School workspace created!');
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
        code: joinCode.trim(),
        role_type: 'admin',
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

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ===== SUCCESS SCREEN =====
  if (mode === 'success' && result) {
    const codes = [
      { label: 'Teacher Join Code', code: result.codes.teacher, icon: Users, color: 'text-primary' },
      { label: 'Student Join Code', code: result.codes.student, icon: GraduationCap, color: 'text-info' },
      { label: 'Admin Join Code', code: result.codes.admin, icon: Shield, color: 'text-accent' },
    ];
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Your BlockWard school is ready</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Share these codes with your teachers, students, and fellow administrators.
            </p>
          </div>

          <Card className="border-border bg-card/60 backdrop-blur-md mb-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                {result.school.logo_url ? (
                  <img src={result.school.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover border border-border" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-7 w-7 text-primary" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{result.school.name}</h2>
                  <p className="text-xs text-muted-foreground capitalize">{(result.school.school_type || 'school').replace(/_/g, ' ')}</p>
                </div>
              </div>

              <div className="space-y-3">
                {codes.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <item.icon className={`h-5 w-5 ${item.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <code className="text-sm font-mono font-medium text-foreground tracking-wider">{item.code}</code>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(item.code, item.label)} className="h-8 w-8 flex-shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-warning/30 bg-warning/5 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Only share each code with the correct user type. Teacher and admin requests require your approval before access is granted.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={() => copyToClipboard(
              `Teacher Code: ${result.codes.teacher}\nStudent Code: ${result.codes.student}\nAdmin Code: ${result.codes.admin}`,
              'All codes'
            )}>
              <Copy className="h-4 w-4 mr-2" /> Copy All Codes
            </Button>
            <Button className="flex-1" onClick={() => { window.location.href = createPageUrl('AdminDashboard'); }}>
              Go to Admin Dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== MODE SELECT =====
  if (mode === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Welcome to BlockWard Schools</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Before managing teachers, students and achievements, create your school workspace.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => { setMode('create'); setStep(1); }}
              className="group p-6 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">Create My School</h3>
              <p className="text-xs text-muted-foreground mt-1">Set up your organisation from scratch and get join codes</p>
            </button>

            <button
              onClick={() => setMode('join')}
              className="group p-6 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <LogIn className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">Join an Existing School</h3>
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
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
                <Button variant="outline" onClick={() => { setMode(null); setJoinResult(null); }}>Back</Button>
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

  // ===== CREATE MODE — MULTI-STEP =====
  const canContinueStep1 = form.name.trim() && form.contact_email.trim();
  const canSubmit = canContinueStep1 && form.admin_full_name.trim() && form.admin_job_title.trim();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? 'w-12 bg-primary' : 'w-6 bg-border'}`} />
          ))}
        </div>

        <Card className="border-border bg-card/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">
              {step === 1 ? 'Step 1 — School Information' : 'Step 2 — Administrator Details'}
            </CardTitle>
            <CardDescription>
              {step === 1 ? 'Enter your school details below' : 'Confirm your administrator information'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>School Type</Label>
                    <select
                      value={form.school_type}
                      onChange={e => setForm(f => ({ ...f, school_type: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email *</Label>
                    <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="admin@school.edu" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Website (optional)</Label>
                    <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone (optional)</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+971..." />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Address (optional)</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
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
                  <Button onClick={() => setStep(2)} disabled={!canContinueStep1} className="flex-1">Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="p-3 rounded-lg border border-border bg-muted/30 mb-2">
                  <p className="text-xs text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-medium text-foreground">{user?.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input value={form.admin_full_name} onChange={e => setForm(f => ({ ...f, admin_full_name: e.target.value }))} placeholder="e.g. Sarah Johnson" />
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title *</Label>
                    <Input value={form.admin_job_title} onChange={e => setForm(f => ({ ...f, admin_job_title: e.target.value }))} placeholder="e.g. Principal" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department (optional)</Label>
                    <Input value={form.admin_department} onChange={e => setForm(f => ({ ...f, admin_department: e.target.value }))} placeholder="e.g. Administration" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone (optional)</Label>
                    <Input value={form.admin_phone} onChange={e => setForm(f => ({ ...f, admin_phone: e.target.value }))} placeholder="+971..." />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                  <Button onClick={handleCreateSchool} disabled={!canSubmit || submitting} className="flex-1">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create School Workspace <Rocket className="h-4 w-4 ml-2" /></>}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
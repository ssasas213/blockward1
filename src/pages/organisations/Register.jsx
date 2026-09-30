import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { guardedRedirect, setPostAuthRedirect } from '@/lib/authRedirectGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RouteSeo from '@/components/RouteSeo';
import { Building2, Check, Loader2, Upload, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const ORG_TYPES = [
  ['company', 'Company'],
  ['university', 'University'],
  ['school', 'School'],
  ['certification_provider', 'Certification Provider'],
  ['training_provider', 'Training Organisation'],
  ['competition', 'Competition'],
  ['sports_organisation', 'Sports Organisation'],
  ['nonprofit', 'Non-profit'],
  ['professional_organisation', 'Professional Association'],
  ['other', 'Other'],
];

/**
 * Register — organisation onboarding (/register-organisation). The signed-in
 * person who registers becomes the organisation's OWNER. The organisation is
 * written to the database immediately as an IssuerOrganisation with status
 * PENDING_REVIEW — it is persistent and searchable right away, and only
 * Blockward staff can later grant it verified-issuer authority.
 */
export default function Register() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', org_type: 'company', website: '', contact_email: '',
    email_domain: '', country: '', logo_url: '', description: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        if (!u) throw new Error('not authed');
        const profiles = await base44.entities.UserProfile.filter({ user_email: u.email }).catch(() => []);
        if (!profiles.length) throw new Error('no profile');
        setUser(u);
        setForm((f) => ({ ...f, contact_email: f.contact_email || u.email }));
      } catch {
        // Organisation registration needs a normal Blockward account first —
        // registration is preserved as the post-auth destination.
        setPostAuthRedirect('/register-organisation');
        guardedRedirect('/Signup');
        return;
      }
      setLoading(false);
    })();
  }, []);

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      if (res?.file_url) { set('logo_url', res.file_url); toast.success('Logo uploaded'); }
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (form.name.trim().length < 2) { setError('Add the organisation name.'); return; }
    if (form.website && !/^https:\/\//i.test(form.website)) { setError('Website must start with https://'); return; }
    if (!form.contact_email.includes('@')) { setError('Add a valid official email.'); return; }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('orgRegister', {
        name: form.name.trim(),
        org_type: form.org_type,
        website: form.website.trim() || undefined,
        contact_email: form.contact_email.trim(),
        email_domain: form.email_domain.trim() || undefined,
        country: form.country.trim() || undefined,
        logo_url: form.logo_url || undefined,
        description: form.description.trim() || undefined,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Registration failed');
      setCreated(res.data.org || { name: form.name.trim() });
      toast.success('Organisation registered');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Success — the organisation now exists as a persistent record ──
  if (created) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <RouteSeo title="Organisation registered · Blockward" description="Your organisation is registered on Blockward" index={false} />
        <Card className="w-full max-w-lg surface-card">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-success/10 border border-success/25 flex items-center justify-center">
              <Check className="h-7 w-7 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{created.name} is registered</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are the Organisation Owner. The organisation is saved permanently and is now
              searchable on Blockward — its status is <span className="text-warning font-medium">Pending Review</span>.
              Blockward staff verify organisations before they receive the Verified Issuer badge.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button onClick={() => (window.location.href = '/organisations/dashboard')}>
                Organisation Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/organisations/dashboard')}>
                Invite Verifiers
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <RouteSeo title="Register your organisation · Blockward" description="Create an Issuer Organisation on Blockward" index={false} />
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Register your organisation</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You'll become the Organisation Owner. Verifiers join later by invitation.
          </p>
        </div>

        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Organisation details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Organisation name</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Dubai College" disabled={submitting} />
              </div>

              <div className="space-y-2">
                <Label>Organisation type</Label>
                <Select value={form.org_type} onValueChange={(v) => set('org_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://example.org" disabled={submitting} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. United Arab Emirates" disabled={submitting} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Official email</Label>
                  <Input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="verify@org.com" disabled={submitting} />
                </div>
                <div className="space-y-2">
                  <Label>Official email domain</Label>
                  <Input value={form.email_domain} onChange={(e) => set('email_domain', e.target.value)} placeholder="org.com" disabled={submitting} />
                  <p className="text-xs text-muted-foreground">Helps confirm your verifiers are authorised.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Organisation logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                {form.logo_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <img src={form.logo_url} alt="Logo preview" className="h-8 w-8 rounded object-cover" />
                    <span className="text-sm text-foreground truncate flex-1">Logo uploaded</span>
                    <button type="button" onClick={() => set('logo_url', '')} className="text-muted-foreground hover:text-destructive">×</button>
                  </div>
                ) : (
                  <label className="cursor-pointer inline-flex">
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
                    <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground hover:bg-hover transition-colors">
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload logo
                    </span>
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What your organisation issues achievements for" disabled={submitting} />
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Organisation <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                The organisation is saved to Blockward's database immediately — refreshing or signing out never loses it.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already invited to an organisation?{' '}
          <a href="/organisation" className="text-primary font-medium hover:underline">Join with an invitation</a>
        </p>
      </div>
    </div>
  );
}
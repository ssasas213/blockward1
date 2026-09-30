import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Search, Building2, Loader2, Upload, X, FileText, ExternalLink,
  ShieldCheck, Clock, PenTool, UserPlus,
} from 'lucide-react';

const CATEGORIES = [
  ['certification', 'Certification'], ['competition', 'Competition'], ['academic', 'Academic'],
  ['professional', 'Professional'], ['course', 'Course'], ['training', 'Training'],
  ['award', 'Award'], ['challenge', 'Challenge'], ['other', 'Other'],
];

const STATUS_META = {
  unverified: { label: 'Unverified', cls: 'bg-secondary text-muted-foreground border-border' },
  verification_requested: { label: 'Awaiting issuer', cls: 'bg-warning/10 text-warning border-warning/30' },
  issuer_confirmed: { label: 'Issuer confirmed', cls: 'bg-info/10 text-info border-info/30' },
  blockchain_processing: { label: 'Securing on Polygon Amoy', cls: 'bg-warning/10 text-warning border-warning/30' },
  verified: { label: 'Blockward Verified', cls: 'bg-success/10 text-success border-success/30' },
  rejected: { label: 'Could not verify', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  revoked: { label: 'Revoked', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const EMPTY_FORM = {
  title: '', category: '', description: '', date: '', expires: '',
  issuer_org: '', issuer_org_id: '', issuer_status: '', issuer_email: '', issuer_website: '',
  certificate_url: '', certificate_name: '',
  evidence: [], linkUrl: '', linkName: '',
};

export default function MyAchievements() {
  const [items, setItems] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  // Issuer picker
  const [issuerQuery, setIssuerQuery] = useState('');
  const [issuerResults, setIssuerResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', website: '', contact_email: '' });
  const [inviting, setInviting] = useState(false);

  // Verification request
  const [requestFor, setRequestFor] = useState(null); // achievement
  const [requestEmail, setRequestEmail] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    // RLS scopes every query to the signed-in holder.
    const [achs, reqs, creds] = await Promise.all([
      base44.entities.Achievement.filter({}, { sort: '-created_date', limit: 50 }),
      base44.entities.VerificationRequest.filter({}, { sort: '-created_date', limit: 50 }),
      base44.entities.Credential.filter({}, { limit: 50 }),
    ]);
    const reqByAch = new Map((reqs.items || reqs).map((r) => [r.achievement_id, r]));
    const credByAch = new Map((creds.items || creds).map((c) => [c.achievement_id, c]));
    setItems(((achs.items || achs) || []).map((a) => ({
      ...a,
      request: reqByAch.get(a.id) || null,
      credential: credByAch.get(a.id) || null,
    })));
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── Issuer search (verified Issuer Organisations) ──
  const runIssuerSearch = async (q) => {
    setIssuerQuery(q);
    if (!q || q.length < 2) { setIssuerResults(null); return; }
    setSearching(true);
    try {
      const res = await base44.functions.invoke('searchIssuers', { q });
      setIssuerResults(res.data?.results || []);
    } catch { setIssuerResults([]); } finally { setSearching(false); }
  };

  const pickIssuer = (o) => {
    setForm((f) => ({ ...f, issuer_org: o.name, issuer_org_id: o.id || '', issuer_status: o.status || 'pending', issuer_email: o.contact_email || '', issuer_website: o.website || '' }));
    setIssuerQuery(o.name);
    setIssuerResults(null);
  };

  const submitInvite = async () => {
    if (invite.name.trim().length < 2) { toast.error('Add the organisation name'); return; }
    if (!invite.contact_email.includes('@')) { toast.error('Add a valid contact email for the organisation'); return; }
    setInviting(true);
    try {
      const res = await base44.functions.invoke('searchIssuers', { action: 'suggest', ...invite });
      if (res.data?.ok) {
        toast.success(`Invitation emailed to ${invite.name} — you'll be able to request verification once they join.`);
        setInviteOpen(false);
        set('issuer_org', invite.name.trim());
        set('issuer_email', invite.contact_email.trim());
        setInvite({ name: '', website: '', contact_email: '' });
      } else { toast.error(res.data?.error || 'Could not send the invitation'); }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not send the invitation');
    } finally { setInviting(false); }
  };

  const uploadOne = async (file, kind) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      if (res?.file_uri) {
        if (kind === 'certificate') { set('certificate_url', res.file_uri); set('certificate_name', file.name); }
        else set('evidence', [...form.evidence, { name: file.name, url: res.file_uri }]);
      }
    } catch { toast.error('Upload failed — try again'); } finally { setUploading(false); }
  };

  const handleCreate = async () => {
    if (form.title.trim().length < 3) { toast.error('Add a title'); return; }
    if (!form.category) { toast.error('Pick a category'); return; }
    if (!form.date) { toast.error('Add the date achieved'); return; }
    if (form.issuer_org && !form.issuer_email) { toast.error('Add the issuer contact email so they can be asked to verify'); return; }
    if (!form.issuer_org) { toast.error('Connect the organisation that issued this achievement'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('createAchievement', {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        date_achieved: form.date,
        expires_at: form.expires || null,
        issuer_org: form.issuer_org.trim(),
        issuer_email: form.issuer_email.trim(),
        issuer_website: form.issuer_website.trim() || null,
        certificate_url: form.certificate_url || null,
        certificate_name: form.certificate_name || null,
        evidence: form.evidence,
      });
      if (res.data?.ok) {
        toast.success('Achievement added — now request verification from the issuer');
        setAddOpen(false);
        setForm(EMPTY_FORM);
        setIssuerQuery(''); setIssuerResults(null);
        load();
      } else { toast.error(res.data?.error || 'Could not add the achievement'); }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not add the achievement');
    } finally { setSaving(false); }
  };

  const openRequest = (a) => {
    setRequestFor(a);
    setRequestEmail(a.issuer_email || '');
  };

  const submitRequest = async () => {
    if (!requestEmail.includes('@')) { toast.error('Add the issuer contact email'); return; }
    setRequesting(true);
    try {
      // Prefer the persistent organisation queue when the issuer is a
      // registered Blockward Issuer Organisation; fall back to the
      // email-token flow for issuers that aren't on Blockward yet.
      let orgId = requestFor.issuer_org_id || null;
      if (!orgId && requestFor.issuer_org) {
        try {
          const s = await base44.functions.invoke('searchIssuers', { q: requestFor.issuer_org });
          const match = (s.data?.results || []).find((o) => (o.name || '').toLowerCase() === (requestFor.issuer_org || '').toLowerCase());
          if (match) orgId = match.id;
        } catch { /* fall through to the token flow */ }
      }
      const res = orgId
        ? await base44.functions.invoke('requestOrgVerification', { achievement_id: requestFor.id, org_id: orgId })
        : await base44.functions.invoke('requestVerification', { achievement_id: requestFor.id, issuer_email: requestEmail.trim() });
      if (res.data?.ok) { toast.success('Verification request sent'); setRequestFor(null); load(); }
      else { toast.error(res.data?.error || 'Could not send the request'); }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not send the request');
    } finally { setRequesting(false); }
  };

  const retryAnchor = async (a) => {
    if (!a.credential?.id) return;
    setRetryingId(a.id);
    try {
      const res = await base44.functions.invoke('retryAnchor', { credential_id: a.credential.id });
      if (res.data?.ok) { toast.success('Retrying blockchain confirmation…'); load(); }
      else { toast.error(res.data?.error || 'Could not retry — please try again shortly'); }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not retry — please try again shortly');
    } finally { setRetryingId(null); }
  };

  if (items === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My achievements</h1>
          <p className="text-sm text-muted-foreground mt-1">Add achievements, connect the issuer, and get them Blockward Verified.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add achievement
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="py-14 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">No achievements yet</h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Add your first achievement — certificates, competition results, courses, awards. The issuing
              organisation's verifiers confirm it, then Blockward secures it on Polygon.
            </p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add achievement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((a) => {
            const meta = STATUS_META[a.status] || STATUS_META.unverified;
            const r = a.request;
            return (
              <Card key={a.id} className="surface-card">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{a.title}</h3>
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-tertiary capitalize">{(a.category || '').replace(/_/g, ' ')} · {a.issuer_org || 'No issuer connected'}{a.date_achieved ? ` · ${format(new Date(a.date_achieved), 'd MMM yyyy')}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {['unverified', 'rejected'].includes(a.status) && (
                        <Button size="sm" onClick={() => openRequest(a)}>
                          <PenTool className="h-3.5 w-3.5 mr-1.5" /> Request verification
                        </Button>
                      )}
                      {['verification_requested', 'issuer_confirmed'].includes(a.status) && (
                        <Button size="sm" variant="outline" onClick={() => openRequest(a)}>
                          <PenTool className="h-3.5 w-3.5 mr-1.5" /> Resend request
                        </Button>
                      )}
                      {a.credential && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/verify/${a.credential.bw_id}`}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View credential
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Request progress */}
                  {r && ['pending', 'opened', 'approved'].includes(r.status) && (
                    <div className="mt-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {r.status === 'approved' ? 'Issuer verification complete' : `Awaiting ${r.required_signatures || 1} verifier signature${(r.required_signatures || 1) > 1 ? 's' : ''}`}
                      </span>
                      {(r.required_signatures || 1) > 1 && (
                        <span className="font-medium text-foreground">{r.signature_count || 0} of {r.required_signatures} signatures</span>
                      )}
                      {r.status === 'approved' && a.status === 'issuer_confirmed' && !a.credential && (
                        <span className="text-info">Issuer verified — awaiting Blockward organisation approval</span>
                      )}
                      {r.status === 'approved' && ['pending', 'processing'].includes(a.credential?.anchor_status) && (
                        <span className="text-warning">Securing on Polygon Amoy…</span>
                      )}
                      {r.status === 'approved' && a.credential?.anchor_status === 'confirmed' && (
                        <span className="text-success">Blockchain secured — confirming integrity…</span>
                      )}
                      {r.status === 'approved' && a.credential?.anchor_status === 'failed' && (
                        <>
                          <span className="text-destructive">Blockchain confirmation delayed</span>
                          <Button size="sm" variant="outline" onClick={() => retryAnchor(a)} disabled={retryingId === a.id}>
                            {retryingId === a.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                            Retry
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {r && r.status === 'rejected' && (
                    <p className="mt-3 text-xs text-destructive">The issuer could not verify this{r.decision_reason ? ` — "${r.decision_reason}"` : ''}.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add achievement ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add an achievement</DialogTitle>
            <DialogDescription>
              Achievements always start unverified — verification comes from the issuing organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Achievement title</Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. AWS Certified Solutions Architect" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date achieved</Label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Expiry date <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="date" value={form.expires} onChange={(e) => set('expires', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>What is it?</Label>
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What you did, where and when" />
            </div>

            {/* Issuer search */}
            <div className="sm:col-span-2 space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
              <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /> Issuing organisation</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
                <Input
                  value={issuerQuery}
                  onChange={(e) => runIssuerSearch(e.target.value)}
                  placeholder="Search organisations…"
                  className="pl-9"
                />
                {searching && <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-tertiary" />}
              </div>
              {issuerResults !== null && issuerResults.length > 0 && (
                <div className="rounded-lg border border-border divide-y divide-border max-h-44 overflow-y-auto">
                  {issuerResults.map((o) => (
                    <button key={o.id} type="button" onClick={() => pickIssuer(o)} className="w-full text-left px-3 py-2 hover:bg-hover flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-sm text-foreground truncate">{o.name}</span>
                        <span className="block text-[10px] text-tertiary capitalize truncate">{(o.org_type || 'other').replace(/_/g, ' ')}</span>
                      </span>
                      {o.status === 'verified' ? (
                        <span className="text-[10px] text-success flex items-center gap-1 flex-shrink-0"><ShieldCheck className="h-3 w-3" /> Verified Issuer</span>
                      ) : (
                        <span className="text-[10px] text-warning flex items-center gap-1 flex-shrink-0"><Clock className="h-3 w-3" /> Registered — Verification Pending</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {issuerResults !== null && issuerResults.length === 0 && !searching && (
                <button type="button" onClick={() => setInviteOpen(true)} className="text-sm text-primary hover:underline flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> Can't find your issuer? Invite the organisation
                </button>
              )}
              {form.issuer_org && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="text-foreground font-medium">{form.issuer_org}</span>
                  {form.issuer_email ? ` · ${form.issuer_email}` : ''}
                </p>
              )}
            </div>

            {/* Certificate */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> Certificate <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {form.certificate_url ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground truncate flex-1">{form.certificate_name}</span>
                  <button type="button" onClick={() => { set('certificate_url', ''); set('certificate_name', ''); }} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <label className="cursor-pointer inline-flex">
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => uploadOne(e.target.files?.[0], 'certificate')} />
                  <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-hover transition-colors">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload certificate
                  </span>
                </label>
              )}
            </div>

            {/* Evidence */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Evidence</Label>
              {form.evidence.length > 0 && (
                <div className="space-y-1.5">
                  {form.evidence.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground truncate flex-1">{e.name}</span>
                      <button type="button" onClick={() => set('evidence', form.evidence.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer inline-flex">
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { for (const f of Array.from(e.target.files || [])) uploadOne(f, 'evidence'); }} />
                <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-hover transition-colors">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload evidence
                </span>
              </label>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add achievement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite organisation ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite your issuer</DialogTitle>
            <DialogDescription>
              We'll email the organisation an invitation to join Blockward. Once they register and are
              verified, you can request verification from them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Organisation name</Label>
              <Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="e.g. Emirates Robotics Society" /></div>
            <div className="space-y-1.5"><Label>Website <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={invite.website} onChange={(e) => setInvite({ ...invite, website: e.target.value })} placeholder="https://…" /></div>
            <div className="space-y-1.5"><Label>Organisation contact email</Label>
              <Input type="email" value={invite.contact_email} onChange={(e) => setInvite({ ...invite, contact_email: e.target.value })} placeholder="info@organisation.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
            <Button onClick={submitInvite} disabled={inviting}>
              {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Invite Organisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Request verification ── */}
      <Dialog open={!!requestFor} onOpenChange={(v) => !v && setRequestFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request verification</DialogTitle>
            <DialogDescription>
              The issuer organisation receives a secure verification link. They confirm the achievement,
              their verifier signs it, and Blockward secures it on Polygon.
            </DialogDescription>
          </DialogHeader>
          {requestFor && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{requestFor.title}</p>
                <p className="text-xs text-tertiary mt-0.5">{requestFor.issuer_org}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Issuer contact email</Label>
                <Input type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} placeholder="verifier@organisation.com" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestFor(null)} disabled={requesting}>Cancel</Button>
            <Button onClick={submitRequest} disabled={requesting}>
              {requesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
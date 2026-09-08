import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Upload, LinkIcon, X, Shield, FileText, Users, Building2, UserCheck,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import TeamParticipantsEditor from '@/components/achievements/TeamParticipantsEditor';
import { base44 } from '@/api/base44Client';
import CoverImagePicker from '@/components/achievements/CoverImagePicker';
import { validateEvidenceFile, processEvidenceImage } from '@/lib/achievementImages';
import { CATEGORY_LABELS, TIER_LABELS, INDEPENDENT_ROLE_OPTIONS } from '@/lib/achievementRequests';

const EMPTY = {
  mode: 'org', // 'org' | 'independent'
  orgId: '', credentialTypeId: '', customLabel: '', category: '', tier: '',
  title: '', description: '', imageUrl: '', date: '', verifierEmail: '', externalEmail: '',
  evidence: [], linkUrl: '', linkName: '',
  isTeam: false, myRole: '', participants: [],
  ivName: '', ivEmail: '', ivRole: '', ivOrg: '', ivRelationship: '',
};

// Student-facing form for creating / editing an achievement request. The
// first question is WHO can verify this: an organisation on BlockWard (the
// staff flow) or someone who was there (an independent verifier, available
// with no organisation at all).
export default function RequestForm({ open, onOpenChange, meta, initial, onSubmit, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  const isEdit = !!initial;
  const resubmitting = initial?.status === 'changes_requested';
  const editing = isEdit && ['draft', 'changes_requested'].includes(initial.status);

  const hasOrgs = (meta?.orgs || []).length > 0;
  const independent = form.mode === 'independent';

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const iv = initial.independent_verifier || {};
      setForm({
        mode: initial.verification_mode === 'independent' ? 'independent' : 'org',
        orgId: initial.school_id || '',
        credentialTypeId: initial.is_custom_credential ? 'other' : (initial.credential_type_id || ''),
        customLabel: initial.is_custom_credential ? (initial.credential_type_title || '') : '',
        category: initial.category || '',
        tier: initial.verification_tier ? String(initial.verification_tier) : '',
        title: initial.title || '',
        description: initial.description || '',
        imageUrl: initial.image_url || '',
        date: initial.date_achieved || '',
        verifierEmail: initial.nominated_verifier_email || '',
        externalEmail: initial.external_verifier_email || '',
        evidence: initial.evidence || [],
        isTeam: !!initial.is_team,
        myRole: initial.my_team_role || '',
        participants: initial.team_participants || [],
        linkUrl: '', linkName: '',
        ivName: iv.name || '',
        ivEmail: iv.email || '',
        ivRole: iv.role || '',
        ivOrg: iv.organisation_label || '',
        ivRelationship: iv.relationship || '',
      });
    } else {
      // No organisations → independent is the only path.
      setForm({ ...EMPTY, mode: hasOrgs ? 'org' : 'independent', orgId: hasOrgs ? meta.orgs[0].id : '' });
    }
  }, [open, initial]);

  if (!meta) return null;

  // With multiple organisations, templates and staff are scoped per org.
  const orgTemplates = meta.templates.filter((t) => !t.school_id || t.school_id === form.orgId);
  const orgStaff = meta.staff.filter((s) => !s.school_id || s.school_id === form.orgId);
  const selectedTemplate = orgTemplates.find((t) => t.id === form.credentialTypeId);
  const isCustom = form.credentialTypeId === 'other';
  const effectiveTier = isCustom ? Number(form.tier) || 0 : selectedTemplate?.verification_tier || 0;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addLink = () => {
    const url = form.linkUrl.trim();
    if (!url) return;
    set('evidence', [...form.evidence, { type: 'link', url, name: form.linkName.trim() || url }]);
    set('linkUrl', ''); set('linkName', '');
  };

  const uploadFiles = async (files) => {
    if (!files?.length) return;
    const room = 5 - form.evidence.length;
    if (room <= 0) { toast.error('You can attach up to 5 pieces of evidence'); return; }
    setUploading(true);
    try {
      const added = [];
      for (const file of Array.from(files).slice(0, room)) {
        const err = validateEvidenceFile(file);
        if (err) { toast.error(`${file.name}: ${err}`); continue; }
        // Images are compressed client-side; PDFs pass through untouched.
        const processed = await processEvidenceImage(file);
        const res = await base44.integrations.Core.UploadFile({ file: processed });
        if (res?.file_url) added.push({ type: 'file', url: res.file_url, name: file.name });
      }
      if (added.length) set('evidence', [...form.evidence, ...added]);
    } catch (e) {
      toast.error('Upload failed — try again');
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = () => {
    if (independent) {
      return {
        verification_mode: 'independent',
        title: form.title,
        description: form.description,
        category: form.category,
        image_url: form.imageUrl || null,
        date_achieved: form.date,
        evidence: form.evidence,
        independent_verifier: {
          name: form.ivName.trim(),
          email: form.ivEmail.trim(),
          role: form.ivRole,
          organisation_label: form.ivOrg.trim() || null,
          relationship: form.ivRelationship.trim() || null,
        },
      };
    }
    return {
      verification_mode: 'organisation',
      school_id: form.orgId,
      credential_type_id: isCustom ? null : form.credentialTypeId,
      custom_credential_label: isCustom ? form.customLabel : null,
      category: isCustom ? form.category : selectedTemplate?.category || form.category,
      verification_tier: effectiveTier,
      title: form.title,
      description: form.description,
      image_url: form.imageUrl || null,
      date_achieved: form.date,
      evidence: form.evidence,
      nominated_verifier_email: form.verifierEmail,
      external_verifier_email: effectiveTier === 3 ? form.externalEmail : null,
      is_team: form.isTeam,
      my_team_role: form.isTeam ? form.myRole : null,
      team_participants: form.isTeam
        ? form.participants.map((p) => ({ email: p.email, name: p.name || null, role: p.role }))
        : [],
    };
  };

  const handleSave = (submit) => {
    if (!submit) {
      if (!form.title.trim()) { toast.error('Add a title before saving'); return; }
      if (independent && !form.ivEmail.trim()) { toast.error("Add the verifier's email before saving"); return; }
    } else if (independent) {
      if (!form.category) { toast.error('Pick a category'); return; }
      if (!form.title.trim()) { toast.error('Add a title'); return; }
      if (!form.date) { toast.error('Add the date achieved'); return; }
      if (!form.ivName.trim()) { toast.error("Add the verifier's full name"); return; }
      if (!form.ivEmail.includes('@')) { toast.error("Add the verifier's email"); return; }
      if (!form.ivRole) { toast.error("Pick the verifier's role"); return; }
      // Evidence matters more without an institutional record behind the claim.
      if (form.evidence.length === 0) { toast.error('Attach at least one piece of evidence — it is all your verifier has to go on'); return; }
    } else {
      if (!isCustom && !form.credentialTypeId) { toast.error('Pick a credential type'); return; }
      if (isCustom && !form.customLabel.trim()) { toast.error('Name your credential type'); return; }
      if (!form.title.trim()) { toast.error('Add a title'); return; }
      if (!form.date) { toast.error('Add the date achieved'); return; }
      if (!form.verifierEmail) { toast.error('Nominate a verifier'); return; }
      if (effectiveTier === 3 && !form.externalEmail.trim()) { toast.error('Add an external verifier contact email'); return; }
      if (form.evidence.length === 0) { toast.error('Attach at least one piece of evidence'); return; }
      if (form.isTeam && form.participants.length === 0) { toast.error('Add at least one teammate'); return; }
    }
    onSubmit(buildPayload(), { submit, resubmit: resubmitting });
  };

  const canSwitchMode = !editing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit achievement request' : 'Request an achievement'}</DialogTitle>
          <DialogDescription>
            {resubmitting
              ? 'Update your request and resubmit it for verification.'
              : independent
                ? 'Someone who was there will confirm this by email — no BlockWard account needed for them.'
                : 'Tell us what you achieved — your organisation will verify it before it appears on your profile.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ── Who can verify this? ── */}
          <div className="sm:col-span-2 space-y-2">
            <Label>Who can verify this?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {hasOrgs && (
                <button
                  type="button"
                  disabled={!canSwitchMode}
                  onClick={() => set('mode', 'org')}
                  className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${!independent ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}
                  aria-pressed={!independent}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className={`h-4 w-4 ${!independent ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-semibold text-foreground">An organisation on BlockWard</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your school or club's staff verify it — the strongest tier.
                  </p>
                </button>
              )}
              <button
                type="button"
                disabled={!canSwitchMode}
                onClick={() => set('mode', 'independent')}
                className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${independent ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}
                aria-pressed={independent}
              >
                <div className="flex items-center gap-2">
                  <UserCheck className={`h-4 w-4 ${independent ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-semibold text-foreground">Someone who was there</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasOrgs
                    ? 'An independent verifier confirms it by email — no account needed for them.'
                    : 'An independent verifier confirms it by email — you don\u2019t need an organisation for this.'}
                </p>
              </button>
            </div>
            {independent && (
              <p className="text-xs text-muted-foreground">
                Independent credentials are clearly labelled as verified by a named person, not by a BlockWard organisation.
              </p>
            )}
          </div>

          {/* ── Organisation flow fields ── */}
          {!independent && (
            <>
              {/* Organisation */}
              <div className="space-y-1.5">
                <Label>Organisation</Label>
                <Select
                  value={form.orgId}
                  onValueChange={(v) => {
                    set('orgId', v);
                    // Reset picks that belong to a different organisation.
                    if (form.credentialTypeId && form.credentialTypeId !== 'other' &&
                        !meta.templates.some((t) => t.id === form.credentialTypeId && (!t.school_id || t.school_id === v))) {
                      set('credentialTypeId', '');
                    }
                    if (form.verifierEmail &&
                        !meta.staff.some((s) => s.email === form.verifierEmail && (!s.school_id || s.school_id === v))) {
                      set('verifierEmail', '');
                    }
                  }}
                  disabled={isEdit}
                >
                  <SelectTrigger><SelectValue placeholder="Pick an organisation" /></SelectTrigger>
                  <SelectContent>
                    {meta.orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Credential type */}
              <div className="space-y-1.5">
                <Label>Credential type</Label>
                <Select
                  value={form.credentialTypeId}
                  onValueChange={(v) => { set('credentialTypeId', v); if (v !== 'other') { set('category', ''); set('tier', ''); } }}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a type" /></SelectTrigger>
                  <SelectContent>
                    {orgTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title} · Tier {t.verification_tier || 1}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other — type my own</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isCustom && (
                <>
                  <div className="space-y-1.5">
                    <Label>Your credential type</Label>
                    <Input value={form.customLabel} onChange={(e) => set('customLabel', e.target.value)} placeholder="e.g. Black belt grading" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => set('category', v)}>
                      <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Verification needed</Label>
                    <Select value={form.tier} onValueChange={(v) => set('tier', v)}>
                      <SelectTrigger><SelectValue placeholder="How much verification does this need?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Tier 1 — one verifier signs off</SelectItem>
                        <SelectItem value="2">Tier 2 — verifier + admin approval</SelectItem>
                        <SelectItem value="3">Tier 3 — verifier, admin + external confirmation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {selectedTemplate && (
                <div className="sm:col-span-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  {TIER_LABELS[selectedTemplate.verification_tier || 1]} · set by your organisation
                </div>
              )}
            </>
          )}

          {/* Category — always visible for independent verification */}
          {independent && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className={`space-y-1.5 ${independent ? '' : 'sm:col-span-2'}`}>
            <Label>Achievement title</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Won the regional 400m final" />
          </div>

          {/* Description */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>What did you do?</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
              placeholder="Give your verifier some context — where, when, who else was involved" />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date achieved</Label>
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>

          {!independent && (
            <>
              {/* Verifier */}
              <div className="space-y-1.5">
                <Label>Nominate a verifier</Label>
                <Select value={form.verifierEmail} onValueChange={(v) => set('verifierEmail', v)}>
                  <SelectTrigger><SelectValue placeholder="Pick a staff member" /></SelectTrigger>
                  <SelectContent>
                    {orgStaff.map((s) => (
                      <SelectItem key={s.id} value={s.email}>
                        {s.name} · {s.user_type === 'admin' ? 'Admin' : 'Teacher'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* External verifier (Tier 3) */}
              {effectiveTier === 3 && (
                <div className="space-y-1.5 sm:col-span-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <Label className="text-foreground">External verifier contact</Label>
                  <Input
                    type="email"
                    value={form.externalEmail}
                    onChange={(e) => set('externalEmail', e.target.value)}
                    placeholder="examiner, referee, federation officer or event organiser email"
                  />
                  <p className="text-xs text-muted-foreground">
                    They'll be emailed a one-time link to confirm this achievement — no account needed.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Independent verifier details ── */}
          {independent && (
            <div className="sm:col-span-2 rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-3">
              <div>
                <Label className="text-foreground">Your verifier</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  They'll get a one-time email link to confirm this achievement. They never need a BlockWard account.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Their full name</Label>
                  <Input value={form.ivName} onChange={(e) => set('ivName', e.target.value)} placeholder="e.g. Sarah Chen" />
                </div>
                <div className="space-y-1.5">
                  <Label>Their email</Label>
                  <Input type="email" value={form.ivEmail} onChange={(e) => set('ivEmail', e.target.value)} placeholder="sarah@example.org" />
                </div>
                <div className="space-y-1.5">
                  <Label>Their role</Label>
                  <Select value={form.ivRole} onValueChange={(v) => set('ivRole', v)}>
                    <SelectTrigger><SelectValue placeholder="Pick their role" /></SelectTrigger>
                    <SelectContent>
                      {INDEPENDENT_ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Their organisation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input value={form.ivOrg} onChange={(e) => set('ivOrg', e.target.value)} placeholder="e.g. Gracie Barra Dubai" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Your relationship to them</Label>
                  <Input value={form.ivRelationship} onChange={(e) => set('ivRelationship', e.target.value)} placeholder="One line — e.g. My club coach for the last 3 years" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Verifying yourself from a second email address is blocked, and disposable email addresses are rejected.
              </p>
            </div>
          )}

          {/* Cover image — public, decorative */}
          <div className="space-y-2 sm:col-span-2 rounded-lg border border-border bg-secondary/30 p-3">
            <div>
              <Label className="text-foreground">Cover photo (public)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shown on your public profile — team photos, prize-giving shots, match photos.
                Without one, we generate a branded cover automatically.
              </p>
            </div>
            <CoverImagePicker imageUrl={form.imageUrl} onChange={(v) => set('imageUrl', v)} />
          </div>

          {/* Evidence */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Evidence</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              {independent
                ? 'Photos, certificate scans or PDFs for your verifier — with no institutional record behind the claim, this is what they\u2019ll go on. Kept separate from your public cover photo.'
                : 'Photos, certificate scans or PDFs for your verifiers — kept separate from your public cover photo.'}
            </p>
            {form.evidence.length > 0 && (
              <div className="space-y-1.5">
                {form.evidence.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    {e.type === 'file' ? <FileText className="h-4 w-4 text-primary" /> : <LinkIcon className="h-4 w-4 text-primary" />}
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-sm text-foreground truncate flex-1 hover:text-primary">{e.name}</a>
                    <button type="button" onClick={() => set('evidence', form.evidence.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
                <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-hover transition-colors">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload file
                </span>
              </label>
              <div className="flex flex-1 min-w-[220px] gap-2">
                <Input value={form.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="Paste a link (article, results page…)" />
                <Button type="button" variant="outline" onClick={addLink}>Add</Button>
              </div>
            </div>
          </div>

          {/* Team achievement — organisation flow only for now */}
          {!independent && (
            <div className="sm:col-span-2 rounded-lg border border-border bg-secondary/50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" /> This was a team achievement
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    One verification covers the whole team — everyone gets their own credential with their role.
                  </p>
                </div>
                <Switch checked={form.isTeam} onCheckedChange={(v) => set('isTeam', v)} />
              </div>
              {form.isTeam && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="space-y-1.5">
                    <Label>Your role in the team</Label>
                    <Input value={form.myRole} onChange={(e) => set('myRole', e.target.value)} placeholder="e.g. Captain, lead developer, first board" />
                  </div>
                  <TeamParticipantsEditor participants={form.participants} onChange={(v) => set('participants', v)} />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          {!resubmitting && (
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || uploading}>
              Save draft
            </Button>
          )}
          <Button onClick={() => handleSave(true)} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {resubmitting ? 'Save & resubmit' : 'Submit for verification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
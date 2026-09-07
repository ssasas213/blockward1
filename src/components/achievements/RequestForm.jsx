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
import { Loader2, Upload, LinkIcon, X, Shield, FileText, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import TeamParticipantsEditor from '@/components/achievements/TeamParticipantsEditor';
import { base44 } from '@/api/base44Client';
import { CATEGORY_LABELS, TIER_LABELS } from '@/lib/achievementRequests';

const EMPTY = {
  orgId: '', credentialTypeId: '', customLabel: '', category: '', tier: '',
  title: '', description: '', date: '', verifierEmail: '', externalEmail: '',
  evidence: [], linkUrl: '', linkName: '',
  isTeam: false, myRole: '', participants: [],
};

// Student-facing form for creating / editing an achievement request.
export default function RequestForm({ open, onOpenChange, meta, initial, onSubmit, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  const isEdit = !!initial;
  const resubmitting = initial?.status === 'changes_requested';
  const editing = isEdit && ['draft', 'changes_requested'].includes(initial.status);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        orgId: initial.school_id || '',
        credentialTypeId: initial.is_custom_credential ? 'other' : (initial.credential_type_id || ''),
        customLabel: initial.is_custom_credential ? (initial.credential_type_title || '') : '',
        category: initial.category || '',
        tier: initial.verification_tier ? String(initial.verification_tier) : '',
        title: initial.title || '',
        description: initial.description || '',
        date: initial.date_achieved || '',
        verifierEmail: initial.nominated_verifier_email || '',
        externalEmail: initial.external_verifier_email || '',
        evidence: initial.evidence || [],
        isTeam: !!initial.is_team,
        myRole: initial.my_team_role || '',
        participants: initial.team_participants || [],
        linkUrl: '', linkName: '',
      });
    } else {
      setForm({ ...EMPTY, orgId: meta?.orgs?.[0]?.id || '' });
    }
  }, [open, initial]);

  if (!meta) return null;

  const selectedTemplate = meta.templates.find((t) => t.id === form.credentialTypeId);
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
    setUploading(true);
    try {
      const added = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const res = await base44.integrations.Core.UploadFile({ file });
        if (res?.file_url) added.push({ type: 'file', url: res.file_url, name: file.name });
      }
      set('evidence', [...form.evidence, ...added]);
    } catch (e) {
      toast.error('Upload failed — try again');
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = () => ({
    school_id: form.orgId,
    credential_type_id: isCustom ? null : form.credentialTypeId,
    custom_credential_label: isCustom ? form.customLabel : null,
    category: isCustom ? form.category : selectedTemplate?.category || form.category,
    verification_tier: effectiveTier,
    title: form.title,
    description: form.description,
    date_achieved: form.date,
    evidence: form.evidence,
    nominated_verifier_email: form.verifierEmail,
    external_verifier_email: effectiveTier === 3 ? form.externalEmail : null,
    is_team: form.isTeam,
    my_team_role: form.isTeam ? form.myRole : null,
    team_participants: form.isTeam
      ? form.participants.map((p) => ({ email: p.email, name: p.name || null, role: p.role }))
      : [],
  });

  const handleSave = (submit) => {
    if (!submit) {
      if (!form.title.trim()) { toast.error('Add a title before saving'); return; }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit achievement request' : 'Request an achievement'}</DialogTitle>
          <DialogDescription>
            {resubmitting
              ? 'Update your request and resubmit it for review.'
              : 'Tell us what you achieved — your organisation will verify it before it appears on your profile.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Organisation */}
          <div className="space-y-1.5">
            <Label>Organisation</Label>
            <Select value={form.orgId} onValueChange={(v) => set('orgId', v)} disabled={isEdit}>
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
                {meta.templates.map((t) => (
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

          {/* Title */}
          <div className="space-y-1.5 sm:col-span-2">
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

          {/* Verifier */}
          <div className="space-y-1.5">
            <Label>Nominate a verifier</Label>
            <Select value={form.verifierEmail} onValueChange={(v) => set('verifierEmail', v)}>
              <SelectTrigger><SelectValue placeholder="Pick a staff member" /></SelectTrigger>
              <SelectContent>
                {meta.staff.map((s) => (
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

          {/* Evidence */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Evidence</Label>
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
                <input type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
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

          {/* Team achievement */}
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
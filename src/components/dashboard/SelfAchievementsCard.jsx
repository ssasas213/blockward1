import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import RequestForm from '@/components/achievements/RequestForm';
import CoverImagePicker from '@/components/achievements/CoverImagePicker';
import { domainLabel, DOMAIN_ORDER, DOMAIN_LABELS } from '@/lib/achievementDomains';
import { toast } from 'sonner';
import { Plus, Loader2, ShieldQuestion, Clock, BadgeCheck, Trash2 } from 'lucide-react';

const EMPTY_ADD = { title: '', domain: '', date: '', description: '', imageUrl: '', linkUrl: '' };

/**
 * SelfAchievementsCard — the instant, self-reported achievements section.
 * Students add anything here immediately (no staff needed), then request
 * verification through the standard request flow when ready.
 */
export default function SelfAchievementsCard({ profile, userEmail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState(null);
  const [convert, setConvert] = useState(null); // { item, initial }
  const [formOpen, setFormOpen] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);

  const load = useCallback(async () => {
    if (!userEmail || !profile?.id) return;
    try {
      const [selfItems, requests] = await Promise.all([
        base44.entities.SelfReportedAchievement.filter({ student_email: userEmail }),
        base44.entities.AchievementRequest.filter({ student_email: userEmail }),
      ]);
      // Lazy sync: if the linked verification request was minted, mark verified.
      const syncs = [];
      for (const item of selfItems) {
        if (item.status === 'verification_requested' && item.verification_request_id) {
          const req = requests.find((r) => r.id === item.verification_request_id);
          if (req && req.status === 'minted') syncs.push(item.id);
        }
      }
      let synced = [];
      if (syncs.length) {
        synced = await Promise.all(syncs.map((id) =>
          base44.entities.SelfReportedAchievement.update(id, { status: 'verified' }).catch(() => null)
        ));
        syncs.forEach((id, i) => {
          if (synced[i]) {
            const it = selfItems.find((x) => x.id === id);
            if (it) it.status = 'verified';
          }
        });
      }
      setItems(selfItems.sort((a, b) => new Date(b.date_achieved || 0) - new Date(a.date_achieved || 0)));
    } catch (e) {
      console.error('Error loading self-reported achievements:', e);
    } finally {
      setLoading(false);
    }
  }, [userEmail, profile?.id]);

  useEffect(() => { load(); }, [load]);

  const addSave = async () => {
    if (!addForm.title.trim()) { toast.error('Add a title'); return; }
    setSaving(true);
    try {
      await base44.entities.SelfReportedAchievement.create({
        student_id: profile.id,
        student_email: userEmail,
        student_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || userEmail,
        title: addForm.title.trim(),
        description: addForm.description.trim() || null,
        image_url: addForm.imageUrl || null,
        domain: addForm.domain || 'other',
        date_achieved: addForm.date || null,
        evidence: addForm.linkUrl.trim() ? [{ type: 'link', url: addForm.linkUrl.trim(), name: addForm.linkUrl.trim() }] : [],
        status: 'unverified',
      });
      toast.success('Added to your profile — marked unverified until an organisation verifies it');
      setAddForm(EMPTY_ADD);
      setAddOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const startVerify = async (item) => {
    try {
      const res = await base44.functions.invoke('achievementRequestData', { mode: 'student' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not open the request form');
      if (!res.data.orgs?.length) {
        toast.error('Join an organisation first — verification needs someone to verify it');
        return;
      }
      setMeta({ orgs: res.data.orgs, templates: res.data.templates, staff: res.data.staff });
      setConvert({
        item,
        initial: {
          school_id: res.data.orgs[0].id,
          title: item.title,
          description: item.description || '',
          image_url: item.image_url || '',
          date_achieved: item.date_achieved || '',
          evidence: item.evidence || [],
        },
      });
      setFormOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    }
  };

  const handleVerifySubmit = async (payload, { submit }) => {
    setSavingRequest(true);
    try {
      const res = await base44.functions.invoke('achievementRequestAction', {
        action: submit ? 'submit' : 'save_draft',
        form: payload,
        request_id: null,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to submit');
      const rid = res.data.request_id || res.data.request?.id || res.data.id || null;
      await base44.entities.SelfReportedAchievement.update(convert.item.id, {
        status: 'verification_requested',
        verification_request_id: rid,
      });
      toast.success(submit
        ? 'Sent for verification — it stays marked unverified until approved'
        : 'Draft saved — submit it from My achievement requests');
      setFormOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setSavingRequest(false);
    }
  };

  const removeItem = async (item) => {
    try {
      await base44.entities.SelfReportedAchievement.delete(item.id);
      setItems((xs) => xs.filter((x) => x.id !== item.id));
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    }
  };

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Card className="shadow-sm border-warning/25">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4 text-warning" />
            Self-reported achievements
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Add anything instantly — it shows on your public profile marked{' '}
            <span className="text-warning font-medium">Unverified — pending verification</span> until an organisation verifies it.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add achievement
        </Button>
      </CardHeader>
      <CardContent>
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Add your belts, grades, ratings and wins now — request verification later.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${item.status === 'verified' ? 'border-success/30 bg-success/5' : 'border-dashed border-warning/30 bg-warning/5'}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {domainLabel(item.domain)}
                    {item.date_achieved && ` · ${fmtDate(item.date_achieved)}`}
                  </p>
                </div>
                {item.status === 'verified' ? (
                  <Badge variant="success" className="gap-1"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
                ) : item.status === 'verification_requested' ? (
                  <Badge variant="info" className="gap-1"><Clock className="h-3 w-3" /> Verification requested</Badge>
                ) : (
                  <>
                    <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" /> Unverified</Badge>
                    <Button size="sm" variant="outline" onClick={() => startVerify(item)}>
                      Request verification
                    </Button>
                  </>
                )}
                {item.status !== 'verified' && (
                  <button
                    onClick={() => removeItem(item)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Quick-add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a self-reported achievement</DialogTitle>
            <DialogDescription>
              This appears on your profile immediately, clearly marked as unverified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>What did you achieve?</Label>
              <Input
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Blue belt in Brazilian Jiu-Jitsu, ABRSM Piano Grade 5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={addForm.domain} onValueChange={(v) => setAddForm((f) => ({ ...f, domain: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>
                    {DOMAIN_ORDER.map((d) => (
                      <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date achieved</Label>
                <Input type="date" value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Details (optional)</Label>
              <Textarea
                rows={2}
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Where, who awarded it, anything that helps a verifier later"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Cover photo (public)</Label>
              <p className="text-xs text-muted-foreground -mt-0.5">
                Optional — shown on your public profile. Without one we generate a branded cover automatically.
              </p>
              <CoverImagePicker imageUrl={addForm.imageUrl} onChange={(v) => setAddForm((f) => ({ ...f, imageUrl: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Evidence link (optional)</Label>
              <Input
                value={addForm.linkUrl}
                onChange={(e) => setAddForm((f) => ({ ...f, linkUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={addSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add to profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification request form, prefilled from the self-reported item */}
      <RequestForm
        open={formOpen}
        onOpenChange={setFormOpen}
        meta={meta}
        initial={convert?.initial}
        onSubmit={handleVerifySubmit}
        saving={savingRequest}
      />
    </Card>
  );
}
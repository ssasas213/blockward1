import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Award } from 'lucide-react';
import { toast } from 'sonner';

const TIERS = {
  1: 'Tier 1 — Verifier only',
  2: 'Tier 2 — Verifier + admin',
  3: 'Tier 3 — Verifier + admin + external',
};

/**
 * AwardTypesSection — organisation admins configure their credential
 * templates: which approval tier each type requires, and whether students
 * must attach evidence before submitting (enforced server-side at submit).
 */
export default function AwardTypesSection({ schoolId }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', title: '', category: 'academic', verification_tier: '1', requires_evidence: false });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      setTypes(await base44.entities.AwardTypes.filter({ school_id: schoolId }));
    } catch (e) { toast.error('Failed to load credential types'); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.code.trim() || !form.title.trim()) { toast.error('Code and title are required'); return; }
    setSaving(true);
    try {
      await base44.entities.AwardTypes.create({
        school_id: schoolId,
        code: form.code.trim().toUpperCase().replace(/\s+/g, '_'),
        title: form.title.trim(),
        category: form.category,
        verification_tier: Number(form.verification_tier),
        requires_evidence: form.requires_evidence,
        is_active: true,
      });
      toast.success('Credential type created');
      setShowForm(false);
      setForm({ code: '', title: '', category: 'academic', verification_tier: '1', requires_evidence: false });
      load();
    } catch (e) { toast.error(e.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  const patch = async (t, updates) => {
    try {
      await base44.entities.AwardTypes.update(t.id, updates);
      load();
    } catch (e) { toast.error(e.message || 'Failed to update'); }
  };

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4 text-primary" /> Credential Types</CardTitle>
          <CardDescription>Approval requirements per achievement type — enforced when students submit requests</CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" /> New Type</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="p-4 rounded-xl border border-border bg-background/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. TOP_HELPER" /></div>
              <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Top Helper" /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['academic', 'sports', 'arts', 'leadership', 'community', 'special'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Approval required</Label>
                <Select value={form.verification_tier} onValueChange={(v) => setForm(f => ({ ...f, verification_tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map(t => <SelectItem key={t} value={String(t)}>{TIERS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Require evidence</Label>
                <p className="text-xs text-muted-foreground">On by default — students must attach a file or link before submitting this type. Turn off to allow submissions without evidence.</p>
              </div>
              <Switch checked={form.requires_evidence} onCheckedChange={(v) => setForm(f => ({ ...f, requires_evidence: v }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={create} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : types.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No credential types yet — students can still submit custom types with a chosen tier.</p>
        ) : (
          <div className="space-y-2">
            {types.map(t => (
              <div key={t.id} className="p-3 rounded-lg border border-border bg-background/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{t.title}</p>
                    <Badge variant="outline" className="font-mono text-[10px]">{t.code}</Badge>
                    {t.requires_evidence && <Badge variant="warning">Evidence required</Badge>}
                    {!t.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete credential type "${t.title}"? Existing credentials are unaffected.`)) return;
                    await base44.entities.AwardTypes.delete(t.id); toast.success('Deleted'); load();
                  }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Approval:</span>
                    <Select value={String(t.verification_tier || 1)} onValueChange={(v) => patch(t, { verification_tier: Number(v) })}>
                      <SelectTrigger className="h-8 text-xs w-64"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{TIERS[n]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Evidence required:</span>
                    <Switch checked={t.requires_evidence !== false} onCheckedChange={(v) => patch(t, { requires_evidence: v })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
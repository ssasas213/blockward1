import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollText, Loader2, Plus, Pencil } from 'lucide-react';

/**
 * OrgPoliciesPanel — owner-only verification policies: how many verifier
 * signatures each verification needs, and any restrictions.
 */
export default function OrgPoliciesPanel({ org, isOwner, policies, onChanged }) {
  const [editing, setEditing] = useState(null); // null | {} | policy
  const [form, setForm] = useState({ name: '', required_signatures: '1', categories: '', specific: '' });
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOwner) return null;

  const openEditor = (policy) => {
    setEditing(policy || {});
    setForm(policy ? {
      name: policy.name || '',
      required_signatures: String(policy.required_signatures || 1),
      categories: (policy.categories || []).join(', '),
      specific: (policy.specific_verifier_emails || []).join(', '),
    } : { name: '', required_signatures: '1', categories: '', specific: '' });
    setIsActive(policy ? policy.is_active !== false : true);
    setError('');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('orgAction', {
        action: 'set_policy',
        org_id: org.id,
        policy_id: editing?.id || null,
        name: form.name,
        required_signatures: Number(form.required_signatures) || 1,
        categories: form.categories.split(',').map((s) => s.trim()).filter(Boolean),
        specific_verifier_emails: form.specific.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        is_active: isActive,
      });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'Could not save the policy');
      toast.success('Policy saved');
      setEditing(null);
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not save the policy');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-5 w-5 text-primary" />
            Verification policies
            {policies.length > 0 && <Badge variant="secondary">{policies.length}</Badge>}
            <Button size="sm" className="ml-auto" onClick={() => openEditor(null)}>
              <Plus className="h-4 w-4" /> New policy
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {policies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium text-foreground">No policies yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                The default policy requires 1 verifier signature. Add policies for joint verification or specific award types.
              </p>
            </div>
          ) : policies.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <Badge variant={p.is_active !== false ? 'success' : 'secondary'}>
                    {p.is_active !== false ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requires {(p.required_signatures || 1) === 1 ? '1 verifier signature' : `${p.required_signatures} verifier signatures (joint)`}
                  {p.categories?.length ? ` · categories: ${p.categories.join(', ')}` : ' · all categories'}
                  {p.specific_verifier_emails?.length ? ` · restricted to ${p.specific_verifier_emails.length} named verifier(s)` : ''}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => openEditor(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!busy) setEditing(v ? editing : null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit policy' : 'New verification policy'}</DialogTitle>
            <DialogDescription>
              The first matching active policy applies to a verification request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Policy name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Major Academic Award" />
            </div>
            <div className="space-y-1.5">
              <Label>Required verifier signatures</Label>
              <Select value={form.required_signatures} onValueChange={(v) => setForm({ ...form, required_signatures: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — single verification</SelectItem>
                  <SelectItem value="2">2 — joint verification</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categories (optional, comma-separated)</Label>
              <Input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder="e.g. certification, award" />
            </div>
            <div className="space-y-1.5">
              <Label>Restricted to specific verifiers (optional, comma-separated emails)</Label>
              <Input value={form.specific} onChange={(e) => setForm({ ...form, specific: e.target.value })} placeholder="Leave empty — any authorised verifier may sign" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3">
              <span className="text-sm text-foreground">Policy active</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
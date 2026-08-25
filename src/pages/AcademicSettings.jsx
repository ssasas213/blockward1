import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/ui/page-header';
import { Loader2, Plus, Trash2, Check, GraduationCap, Calendar } from 'lucide-react';
import { GRADE_PRESETS } from '@/lib/grades';
import { toast } from 'sonner';
import { useSchool } from '@/lib/SchoolContext';

import RoleGuard from '@/components/auth/RoleGuard';
export default function AcademicSettings() { return <RoleGuard roles={['admin']}><AcademicSettingsImpl/></RoleGuard>; }
function AcademicSettingsImpl() {
  const { activeSchool } = useSchool();
  const [scales, setScales] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScaleForm, setShowScaleForm] = useState(false);
  const [showTermForm, setShowTermForm] = useState(false);

  const load = async () => {
    if (!activeSchool) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        base44.entities.GradingScale.filter({ school_id: activeSchool.id }),
        base44.entities.AcademicTerm.filter({ school_id: activeSchool.id }),
      ]);
      setScales(s); setTerms(t);
    } catch (e) { toast.error('Failed to load academic settings'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeSchool?.id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!activeSchool) return <p className="text-muted-foreground">No active school.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Academic Settings" description="Configure grading scales and academic terms" />

      {/* Grading Scales */}
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4 text-primary" /> Grading Scales</CardTitle>
            <CardDescription>Used to convert percentages into grades across the school</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowScaleForm(true)}><Plus className="h-4 w-4 mr-1" /> New Scale</Button>
        </CardHeader>
        <CardContent>
          {scales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No grading scales configured. A default A*–F scale is used until you create one.</p>
          ) : (
            <div className="space-y-2">
              {scales.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm">{s.name}</p>
                      {s.active && <Badge className="bg-success/15 text-success text-[10px]">Active</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{(s.grade_bands || []).map(b => `${b.grade}≥${b.min_percentage}%`).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!s.active && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        await base44.entities.GradingScale.update(s.id, { active: true });
                        toast.success('Scale activated'); load();
                      }}><Check className="h-3 w-3 mr-1" /> Activate</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('Delete this grading scale?')) return;
                      await base44.entities.GradingScale.delete(s.id); toast.success('Deleted'); load();
                    }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Academic Terms */}
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-primary" /> Academic Terms</CardTitle>
            <CardDescription>Define terms/semesters for grade organisation</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowTermForm(true)}><Plus className="h-4 w-4 mr-1" /> New Term</Button>
        </CardHeader>
        <CardContent>
          {terms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No terms configured. Grades can still be assigned without a term.</p>
          ) : (
            <div className="space-y-2">
              {terms.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                  <div>
                    <p className="font-medium text-foreground text-sm">{t.name} {t.academic_year && <span className="text-muted-foreground font-normal">· {t.academic_year}</span>}</p>
                    <p className="text-xs text-muted-foreground">{t.start_date ? `${t.start_date} → ${t.end_date || ''}` : 'No dates set'}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm('Delete this term?')) return;
                    await base44.entities.AcademicTerm.delete(t.id); toast.success('Deleted'); load();
                  }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showScaleForm && <ScaleForm schoolId={activeSchool.id} onClose={() => setShowScaleForm(false)} onSaved={load} />}
      {showTermForm && <TermForm schoolId={activeSchool.id} onClose={() => setShowTermForm(false)} onSaved={load} />}
    </div>
  );
}

function ScaleForm({ schoolId, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [bands, setBands] = useState(GRADE_PRESETS.letters.bands.map(b => ({ ...b })));
  const [saving, setSaving] = useState(false);

  const applyPreset = (key) => {
    const preset = GRADE_PRESETS[key];
    setName(preset.name);
    setBands(preset.bands.map(b => ({ ...b })));
  };

  const save = async () => {
    if (!name.trim() || bands.length === 0) { toast.error('Name and at least one band required'); return; }
    setSaving(true);
    try {
      await base44.entities.GradingScale.create({
        school_id: schoolId, name: name.trim(),
        grade_bands: bands.map(b => ({ min_percentage: Number(b.min_percentage), grade: String(b.grade), label: b.label || b.grade })),
        active: true,
      });
      toast.success('Grading scale created');
      onSaved(); onClose();
    } catch (e) { toast.error(e.message || 'Failed to create scale'); }
    finally { setSaving(false); }
  };

  return (
    <Card className="surface-card">
      <CardHeader><CardTitle className="text-base">New Grading Scale</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(GRADE_PRESETS).map(([key, p]) => (
            <Button key={key} size="sm" variant="outline" onClick={() => applyPreset(key)}>{p.name}</Button>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Scale Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GCSE 9-1" />
        </div>
        <div className="space-y-2">
          <Label>Grade Bands (highest minimum wins)</Label>
          <div className="space-y-2">
            {bands.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={b.grade} onChange={e => setBands(bs => bs.map((x, j) => j === i ? { ...x, grade: e.target.value } : x))} placeholder="Grade" className="w-24" />
                <span className="text-sm text-muted-foreground">≥</span>
                <Input type="number" value={b.min_percentage} onChange={e => setBands(bs => bs.map((x, j) => j === i ? { ...x, min_percentage: e.target.value } : x))} placeholder="%" className="w-24" />
                <span className="text-sm text-muted-foreground">%</span>
                <Button size="sm" variant="ghost" onClick={() => setBands(bs => bs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setBands(bs => [...bs, { min_percentage: 0, grade: '' }])}><Plus className="h-4 w-4 mr-1" /> Add Band</Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Scale'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TermForm({ schoolId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', academic_year: '', start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Term name required'); return; }
    setSaving(true);
    try {
      await base44.entities.AcademicTerm.create({
        school_id: schoolId,
        name: form.name.trim(),
        academic_year: form.academic_year.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: 'active',
      });
      toast.success('Term created'); onSaved(); onClose();
    } catch (e) { toast.error(e.message || 'Failed to create term'); }
    finally { setSaving(false); }
  };

  return (
    <Card className="surface-card">
      <CardHeader><CardTitle className="text-base">New Academic Term</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Term Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Term 1" /></div>
          <div className="space-y-2"><Label>Academic Year</Label><Input value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))} placeholder="e.g. 2025-2026" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
          <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Term'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
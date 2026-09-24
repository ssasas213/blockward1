import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import RoleGuard from '@/components/auth/RoleGuard';
import {
  ArrowLeft, Loader2, GraduationCap, ClipboardList, CheckCircle2,
  Award, Shield, TrendingUp, TrendingDown, ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const ATT = {
  present: { label: 'Present', variant: 'success' },
  late: { label: 'Late', variant: 'warning' },
  absent: { label: 'Absent', variant: 'destructive' },
  excused: { label: 'Excused', variant: 'secondary' },
};
const WORK_STATUS = {
  assigned: { label: 'Assigned', variant: 'secondary' },
  submitted: { label: 'Turned in', variant: 'info' },
  returned: { label: 'Returned', variant: 'success' },
  resubmitted: { label: 'Re-turned in', variant: 'info' },
};

/**
 * StudentProgress — the authorised teacher's view of one student: grades,
 * work, classroom attendance, points (behaviour points are staff-private)
 * and verified achievements. Server-authorised in studentProgressData: a
 * teacher only ever loads a student they teach.
 */
export default function StudentProgress() {
  return <RoleGuard roles={['teacher', 'admin']}><StudentProgressContent /></RoleGuard>;
}

function StudentProgressContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const studentEmail = urlParams.get('student');

  useEffect(() => {
    if (!studentEmail) { setLoading(false); setError('No student selected.'); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('studentProgressData', { student_email: studentEmail });
        const d = res.data || {};
        if (d.error) throw new Error(d.error);
        setData(d);
      } catch (e) {
        setError(e.message || 'Failed to load student progress');
      } finally {
        setLoading(false);
      }
    })();
  }, [studentEmail]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student progress" description="Grades, work, attendance, points and achievements" />
        <EmptyState icon={ShieldCheck} title="Not available" description={error || 'This student could not be loaded.'}>
          <Button variant="outline" asChild><Link to={createPageUrl('Classes')}><ArrowLeft className="h-4 w-4 mr-2" />Back to classes</Link></Button>
        </EmptyState>
      </div>
    );
  }

  const s = data.student;
  const att = data.attendance || {};

  return (
    <div className="space-y-6">
      <PageHeader title={`${s.first_name} ${s.last_name}`} description="Progress across your classes">
        <Button variant="outline" asChild>
          <Link to={createPageUrl('Classes')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
      </PageHeader>

      {/* Identity summary */}
      <Card className="surface-card">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <InitialsAvatar name={`${s.first_name} ${s.last_name}`} src={s.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-foreground">{s.first_name} {s.last_name}</p>
            <p className="text-sm text-muted-foreground">
              {s.grade_level ? `Year ${s.grade_level}` : 'Student'}{s.student_id ? ` · ID ${s.student_id}` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(data.classes || []).map(c => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="success" className="text-xs"><TrendingUp className="h-3 w-3" />+{s.total_achievement_points || 0}</Badge>
            <Badge variant="destructive" className="text-xs"><TrendingDown className="h-3 w-3" />-{s.total_behaviour_points || 0}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grades */}
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" />Published grades</CardTitle></CardHeader>
          <CardContent>
            {(data.grades || []).length > 0 ? (
              <div className="space-y-2">
                {data.grades.map((g, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{g.assessment_title || g.subject || 'Assessment'}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.subject}{g.term ? ` · ${g.term}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {g.percentage !== null && <span className="text-sm font-semibold text-foreground">{g.percentage}%</span>}
                      {g.grade && <Badge variant="outline">{g.grade}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No published grades yet.</p>}
          </CardContent>
        </Card>

        {/* Work */}
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />Classwork in your classes</CardTitle></CardHeader>
          <CardContent>
            {(data.work || []).length > 0 ? (
              <div className="space-y-2">
                {data.work.map((w, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{w.assignment_title || 'Work'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {w.class_name}{w.submitted_at ? ` · turned in ${format(new Date(w.submitted_at), 'd MMM')}` : ''}{w.is_late ? ' · late' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {typeof w.grade === 'number' && <span className="text-sm font-semibold text-foreground">{w.grade}</span>}
                      <Badge variant={WORK_STATUS[w.status]?.variant || 'secondary'} className="text-[10px]">{WORK_STATUS[w.status]?.label || w.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No work in your classes yet.</p>}
          </CardContent>
        </Card>

        {/* Classroom attendance */}
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Classroom attendance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">BlockWard classroom record — not official MIS attendance.</p>
            {att.total > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <p className="text-3xl font-bold text-foreground">{att.rate !== null ? `${att.rate}%` : '—'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="success">P {att.counts.present}</Badge>
                    <Badge variant="warning">L {att.counts.late}</Badge>
                    <Badge variant="destructive">A {att.counts.absent}</Badge>
                    <Badge variant="secondary">E {att.counts.excused}</Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(att.recent || []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-muted/40">
                      <span className="text-foreground truncate">{r.class_name || 'Class'}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{r.date ? format(new Date(r.date), 'd MMM') : ''}</span>
                        <Badge variant={ATT[r.status]?.variant || 'secondary'} className="text-[10px]">{ATT[r.status]?.label || r.status}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">No registers taken yet in your classes.</p>}
          </CardContent>
        </Card>

        {/* Points */}
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" />Points</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Behaviour points are private — visible to staff and the student, never public.</p>
            {(data.points || []).length > 0 ? (
              <div className="space-y-2">
                {data.points.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{p.category_name || (p.type === 'achievement' ? 'Achievement' : 'Behaviour')}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.reason}{p.teacher_name ? ` · ${p.teacher_name}` : ''}{p.timestamp ? ` · ${format(new Date(p.timestamp), 'd MMM')}` : ''}
                      </p>
                    </div>
                    <Badge variant={p.type === 'achievement' ? 'success' : 'destructive'} className="text-xs flex-shrink-0">
                      {p.points > 0 ? `+${p.points}` : p.points}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No points recorded yet.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Verified achievements */}
      <Card className="surface-card">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Verified achievements</CardTitle></CardHeader>
        <CardContent>
          {(data.achievements || []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.achievements.map(a => (
                <a
                  key={a.verification_id}
                  href={`/verify/${a.verification_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-muted/40 border border-transparent hover:border-primary/30 hover:bg-hover transition-colors"
                >
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.organisation_name || '—'}</p>
                  <p className="text-xs text-tertiary mt-1">
                    {a.date_achieved ? format(new Date(a.date_achieved), 'd MMM yyyy') : ''} · {a.category}
                  </p>
                </a>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No verified achievements yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
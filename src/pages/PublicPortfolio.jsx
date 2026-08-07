import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import {
  Trophy, Shield, CheckCircle2, Calendar, Building2, GraduationCap,
  Sparkles, Award, Users, ExternalLink, Hash, ShieldCheck, Frown,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORY_STYLE = {
  academic: { grad: 'from-blue-500 to-indigo-500', chip: 'bg-blue-500/10 text-blue-400' },
  sports: { grad: 'from-green-500 to-emerald-500', chip: 'bg-green-500/10 text-green-400' },
  arts: { grad: 'from-pink-500 to-rose-500', chip: 'bg-purple-500/10 text-purple-400' },
  leadership: { grad: 'from-amber-500 to-orange-500', chip: 'bg-amber-500/10 text-amber-400' },
  community: { grad: 'from-rose-500 to-pink-500', chip: 'bg-rose-500/10 text-rose-400' },
  behaviour: { grad: 'from-red-500 to-rose-500', chip: 'bg-red-500/10 text-red-400' },
  special: { grad: 'from-indigo-500 to-purple-500', chip: 'bg-indigo-500/10 text-indigo-400' },
};

const CATEGORY_ICONS = {
  academic: GraduationCap,
  sports: Trophy,
  arts: Sparkles,
  leadership: Shield,
  community: Users,
  behaviour: Award,
  special: Sparkles,
};

function categoryStyle(cat) {
  return CATEGORY_STYLE[cat] || CATEGORY_STYLE.special;
}

export default function PublicPortfolio() {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    if (!studentId) { setNotFound(true); setLoading(false); return; }
    load();
  }, [studentId]);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('getPublicPortfolio', { student_id: studentId });
      const result = res.data;
      if (!result.ok) { setNotFound(true); return; }
      setData(result);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center border-border">
          <CardContent className="p-8 space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Frown className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Portfolio not found</h1>
            <p className="text-sm text-muted-foreground">
              This portfolio link is invalid, expired, or no longer available.
            </p>
            <Button asChild className="mt-2">
              <Link to="/">Back to BlockWard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const student = data.student;
  const school = data.school;
  const achievements = data.achievements || [];
  const categories = Object.keys(data.categoryCounts || {});

  const filtered = activeCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[40rem] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-semibold shadow-glow overflow-hidden flex-shrink-0">
              {student.avatar_url ? (
                <img src={student.avatar_url} alt={student.name} className="h-24 w-24 object-cover" />
              ) : (
                student.name?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{student.name}</h1>
              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {student.grade_level && (
                  <Badge variant="outline" className="gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5" /> {student.grade_level}
                  </Badge>
                )}
                {student.student_id_number && (
                  <Badge variant="outline" className="gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> ID {student.student_id_number}
                  </Badge>
                )}
                {school && (
                  <Badge variant="outline" className="gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> {school.name}
                  </Badge>
                )}
              </div>
              {school && (school.city || school.country) && (
                <p className="text-sm text-muted-foreground mt-2">
                  {[school.city, school.country].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            <StatBox icon={Trophy} label="Achievements" value={data.count} />
            <StatBox icon={Award} label="Categories" value={categories.length} />
            <StatBox icon={ShieldCheck} label="Verified" value={achievements.filter(a => a.verification_id).length} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Category chips */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
              All <span className="ml-1 opacity-60">{achievements.length}</span>
            </Chip>
            {categories.map(cat => (
              <Chip key={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)}>
                <span className="capitalize">{cat.replace(/_/g, ' ')}</span>
                <span className="ml-1 opacity-60">{data.categoryCounts[cat]}</span>
              </Chip>
            ))}
          </div>
        )}

        {/* Achievements grid */}
        {filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-10 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Trophy className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground">No public achievements yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Verified BlockWards will appear here once they're delivered to this student's vault.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(a => {
              const style = categoryStyle(a.category);
              const Icon = CATEGORY_ICONS[a.category] || Sparkles;
              return (
                <Card key={a.verification_id} className="card-hover border-border overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn('h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0', style.grad)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground leading-tight line-clamp-2">{a.title}</h3>
                        <span className={cn('inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium capitalize', style.chip)}>
                          {a.category?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {a.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{a.description}</p>
                    )}

                    {a.image_url && (
                      <img src={a.image_url} alt={a.title} className="w-full h-36 object-cover rounded-lg mb-3 border border-border" />
                    )}

                    <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                      {a.date_achieved && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(a.date_achieved), 'MMM d, yyyy')}
                        </div>
                      )}
                      {a.teacher_name && (
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-success" />
                          Verified by {a.teacher_name}
                        </div>
                      )}
                      {a.token_id && (
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5" />
                          <span className="font-mono truncate">Token #{a.token_id}</span>
                        </div>
                      )}
                    </div>

                    {a.verification_id && (
                      <Button size="sm" variant="outline" asChild className="w-full">
                        <Link to={`/verify/${a.verification_id}`}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Verify this achievement
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-border text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Shield className="h-4 w-4 text-primary" /> Verified on BlockWard
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 text-center">
      <Icon className="h-5 w-5 text-primary mx-auto mb-1.5" />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-hover hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
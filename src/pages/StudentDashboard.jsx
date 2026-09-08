import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useSchool } from '@/lib/SchoolContext';
import { loadEarnedAchievements } from '@/lib/achievementLifecycle';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import AchievementGridSkeleton from '@/components/achievements/AchievementGridSkeleton';
import {
  Award, Shield, Calendar, BookOpen,
  ChevronRight, Star, Send
} from 'lucide-react';
import BlockWardCard from '@/components/blockwards/BlockWardCard';
import GradesWidget from '@/components/grades/GradesWidget';
import AttendanceWidget from '@/components/dashboard/AttendanceWidget';
import AssignmentsWidget from '@/components/dashboard/AssignmentsWidget';
import StudentAssembliesWidget from '@/components/dashboard/StudentAssembliesWidget';
import CrossOrgAchievementsCard from '@/components/dashboard/CrossOrgAchievementsCard';
import SelfAchievementsCard from '@/components/dashboard/SelfAchievementsCard';
import StudentOnboardingChecklist from '@/components/dashboard/StudentOnboardingChecklist';

/** Small pulse rows shaped like the real list content — no centred spinners. */
function ListRowSkeleton({ rows = 3, height = 'h-16' }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} rounded-lg bg-muted/60 animate-pulse`} />
      ))}
    </div>
  );
}

function StudentDashboardContent() {
  // Identity comes from SchoolContext — fetched once per session, never here.
  const { user, profile } = useSchool();

  // Per-section loading: null = still loading. The page shell renders
  // immediately; every section resolves and un-skeletons on its own.
  const [myClasses, setMyClasses] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [points, setPoints] = useState(null);
  const [blockWards, setBlockWards] = useState(null);

  useEffect(() => {
    if (!user) return;
    const email = user.email;
    const sid = profile?.school_id || null;
    const today = new Date().getDay();
    const dayIndex = today === 0 ? 6 : today - 1;

    // Every call is independent of the others — one parallel batch, each
    // section resolves into its own state as soon as its data lands.
    const classesP = base44.entities.Class.filter(sid ? { school_id: sid } : {}).catch(() => []);
    const scheduleP = base44.entities.TimetableEntry.filter(
      sid ? { school_id: sid, day_of_week: dayIndex } : { day_of_week: dayIndex }
    ).catch(() => []);
    const pointsP = base44.entities.PointEntry.filter(
      { student_email: email }, '-created_date', 10
    ).catch(() => []);
    const vaultP = loadEarnedAchievements().then(r => r.achievements).catch(() => []);

    classesP.then((all) => setMyClasses(all.filter(c => c.student_emails?.includes(email))));
    pointsP.then(setPoints);
    vaultP.then(setBlockWards);
    Promise.all([classesP, scheduleP]).then(([allClasses, allSchedules]) => {
      const classIds = new Set(allClasses.map(c => c.id));
      setTodaySchedule(
        allSchedules
          .filter(s => classIds.has(s.class_id))
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
    });
  }, [user, profile?.school_id]);

  // Points totals — same derivation as before, computed once points arrive.
  let achievementPoints = 0;
  let behaviourPoints = 0;
  (points || []).forEach(p => {
    if (p.type === 'achievement') achievementPoints += p.points;
    else behaviourPoints += Math.abs(p.points);
  });
  const statsAchievementPoints = profile?.total_achievement_points || achievementPoints;
  const statsBehaviourPoints = profile?.total_behaviour_points || behaviourPoints;
  const recentPoints = (points || []).slice(0, 5);

  // Onboarding state — a brand-new student with no organisations and no
  // achievements sees a single checklist instead of the empty data cards.
  // Unknown until the achievements cache resolves; skeletons show until then.
  const isEmptyState = !profile?.school_id && blockWards !== null && blockWards.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile?.first_name || 'Student'}`}
        description={profile?.grade_level ? `Grade ${profile.grade_level} · Your achievement overview` : 'Your achievement overview'}
      >
        <Button asChild>
          <Link to={createPageUrl('StudentBlockWards')}>
            <Send className="h-4 w-4 mr-2" />
            Request an achievement
          </Link>
        </Button>
      </PageHeader>

      {isEmptyState ? (
        <div className="space-y-6">
          <StudentOnboardingChecklist profile={profile} userEmail={user?.email} />
          {/* Achievements can be added right away — no organisation needed. */}
          <SelfAchievementsCard profile={profile} userEmail={user?.email} />
        </div>
      ) : (
        <>
          {/* My BlockWards — first content block */}
          {(blockWards === null || blockWards.length > 0) && (
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">My BlockWards</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={createPageUrl('StudentBlockWards')}>
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {blockWards === null ? (
                  <AchievementGridSkeleton count={3} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {blockWards.slice(0, 3).map((bw) => (
                      <BlockWardCard key={bw.id} blockWard={bw} onClick={() => window.location.href = createPageUrl(`StudentBlockWards`)} showStudent={false} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Aggregated achievements across every organisation the student belongs to */}
          <CrossOrgAchievementsCard profile={profile} userEmail={user?.email} />

          {/* Self-reported achievements — instant, verifiable later */}
          <SelfAchievementsCard profile={profile} userEmail={user?.email} />

          {/* Stats — one compact row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Achievement Points" value={statsAchievementPoints} icon={Award} />
            <StatCard label="Behaviour Points" value={statsBehaviourPoints} icon={Award} />
            <StatCard label="BlockWards Earned" value={blockWards === null ? '…' : blockWards.length} icon={Shield} />
          </div>

          {/* Today's Classes and Attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Today's Classes</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={createPageUrl('Timetable')}>
                    View Full
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {todaySchedule === null ? (
                  <ListRowSkeleton rows={3} height="h-16" />
                ) : todaySchedule.length > 0 ? (
                  <div className="space-y-2">
                    {todaySchedule.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                        <div className="text-center min-w-[56px]">
                          <p className="text-sm font-medium text-foreground">{entry.start_time}</p>
                          <p className="text-xs text-muted-foreground">{entry.end_time}</p>
                        </div>
                        <div className="w-px h-10 bg-border" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">{entry.class_name || entry.subject}</p>
                          <p className="text-xs text-muted-foreground">Room {entry.room}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Calendar} title="No classes scheduled today" />
                )}
              </CardContent>
            </Card>

            <AttendanceWidget />
          </div>

          {/* Recent Points + Grades */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Points</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={createPageUrl('MyPoints')}>
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {points === null ? (
                  <ListRowSkeleton rows={3} height="h-14" />
                ) : recentPoints.length > 0 ? (
                  <div className="space-y-2">
                    {recentPoints.map((point) => (
                      <div key={point.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${point.type === 'achievement' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                            {point.type === 'achievement' ? <Star className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{point.category_name || point.reason}</p>
                            <p className="text-xs text-muted-foreground truncate">{point.reason}</p>
                          </div>
                        </div>
                        <Badge variant={point.type === 'achievement' ? 'default' : 'destructive'} className="flex-shrink-0">
                          {point.points > 0 ? '+' : ''}{point.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Award} title="No points recorded yet" />
                )}
              </CardContent>
            </Card>

            <GradesWidget />
          </div>

          {/* Assignments + Assemblies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssignmentsWidget />
            <StudentAssembliesWidget />
          </div>

          {/* My Classes */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">My Classes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={createPageUrl('Classes')}>
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {myClasses === null ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" aria-hidden="true">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-[92px] rounded-lg border border-border bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : myClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {myClasses.map((cls) => (
                    <Link
                      key={cls.id}
                      to={createPageUrl(`ClassDetail?id=${cls.id}`)}
                      className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{cls.name}</p>
                          <p className="text-xs text-muted-foreground">{cls.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Room {cls.room || 'TBA'}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon={BookOpen} title="Not enrolled in any classes yet">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={createPageUrl('Classes')}>Join a Class</Link>
                  </Button>
                </EmptyState>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <ProtectedRoute>
      <StudentDashboardContent />
    </ProtectedRoute>
  );
}
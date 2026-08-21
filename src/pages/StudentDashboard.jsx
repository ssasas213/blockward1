import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import {
  Award, Shield, Calendar, BookOpen,
  ChevronRight, Star, FileText
} from 'lucide-react';
import ParentContactSection from '@/components/student/ParentContactSection';
import BlockWardCard from '@/components/blockwards/BlockWardCard';
import GradesWidget from '@/components/grades/GradesWidget';

function StudentDashboardContent() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    myClasses: [],
    todaySchedule: [],
    recentPoints: [],
    blockWards: [],
    achievementPoints: 0,
    behaviourPoints: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (!currentUser) return;

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const profile = profiles.length > 0 ? profiles[0] : null;
      setUserProfile(profile);

      const classFilter = profile?.school_id ? { school_id: profile.school_id } : {};
      const allClasses = await base44.entities.Class.filter(classFilter);
      const myClasses = allClasses.filter(c => c.student_emails?.includes(currentUser.email));

      const today = new Date().getDay();
      const dayIndex = today === 0 ? 6 : today - 1;
      const classIds = myClasses.map(c => c.id);
      const scheduleFilter = profile?.school_id ? { school_id: profile.school_id, day_of_week: dayIndex } : { day_of_week: dayIndex };
      const allSchedules = await base44.entities.TimetableEntry.filter(scheduleFilter);
      const todaySchedule = allSchedules.filter(s => classIds.includes(s.class_id));

      const [points, vaultRes] = await Promise.all([
        base44.entities.PointEntry.filter({ student_email: currentUser.email }, '-created_date', 10),
        base44.functions.invoke('getStudentVault', {})
      ]);
      const blockWards = vaultRes.data?.ok ? (vaultRes.data.achievements || []) : [];

      let achievementPoints = 0;
      let behaviourPoints = 0;
      points.forEach(p => {
        if (p.type === 'achievement') achievementPoints += p.points;
        else behaviourPoints += Math.abs(p.points);
      });

      setStats({
        myClasses,
        todaySchedule: todaySchedule.sort((a, b) => a.start_time.localeCompare(b.start_time)),
        recentPoints: points.slice(0, 5),
        blockWards,
        achievementPoints: profile?.total_achievement_points || achievementPoints,
        behaviourPoints: profile?.total_behaviour_points || behaviourPoints
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${userProfile?.first_name || 'Student'}`}
        description={userProfile?.grade_level ? `Grade ${userProfile.grade_level} · Your achievement overview` : 'Your achievement overview'}
      >
        <Button variant="outline" asChild>
          <Link to={createPageUrl('Timetable')}>
            <Calendar className="h-4 w-4 mr-2" />
            Timetable
          </Link>
        </Button>
        <Button asChild>
          <Link to={createPageUrl('StudentBlockWards')}>
            <Shield className="h-4 w-4 mr-2" />
            My BlockWards
          </Link>
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Achievement Points" value={stats.achievementPoints} icon={Award} />
        <StatCard label="Behaviour Points" value={stats.behaviourPoints} icon={Award} />
        <StatCard label="BlockWards Earned" value={stats.blockWards.length} icon={Shield} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Academic Performance Widget */}
        <GradesWidget />

        {/* Today's Schedule */}
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
            {stats.todaySchedule.length > 0 ? (
              <div className="space-y-2">
                {stats.todaySchedule.map((entry) => (
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

        {/* Recent Points */}
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
            {stats.recentPoints.length > 0 ? (
              <div className="space-y-2">
                {stats.recentPoints.map((point) => (
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
          {stats.myClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.myClasses.map((cls) => (
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

      {/* Parent/Guardian Contact */}
      <ParentContactSection
        profile={userProfile}
        userEmail={user?.email}
        onUpdated={loadDashboardData}
      />

      {/* BlockWards Showcase */}
      {stats.blockWards.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">My BlockWards</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={createPageUrl('BlockWards')}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.blockWards.slice(0, 3).map((bw) => (
                <BlockWardCard key={bw.id} blockWard={bw} onClick={() => window.location.href = createPageUrl(`StudentBlockWards`)} showStudent={false} />
              ))}
            </div>
          </CardContent>
        </Card>
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
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useSchool } from '@/lib/SchoolContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import {
  Users, BookOpen, Award, Calendar,
  Plus, ChevronRight, PenLine, ClipboardCheck, Building2
} from 'lucide-react';
import SignoffQueueWidget from '@/components/dashboard/SignoffQueueWidget';
import TeacherGradebookWidget from '@/components/dashboard/TeacherGradebookWidget';
import TeacherAssignmentsWidget from '@/components/dashboard/TeacherAssignmentsWidget';
import TeacherAssembliesWidget from '@/components/dashboard/TeacherAssembliesWidget';
import TeacherRegisterStatusWidget from '@/components/dashboard/TeacherRegisterStatusWidget';

function TeacherDashboardContent() {
  // Identity comes from SchoolContext — the effective persona in Test Mode,
  // so the greeting and role-gated buttons follow the persona, not the
  // signed-in controller.
  const { profile: userProfile } = useSchool();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    myClasses: [],
    todaySchedule: [],
    recentPoints: [],
    totalStudents: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Persona-aware data — the backend resolves the effective actor
      // (test persona in Test Mode) and reads through the service role, so
      // the stats follow the persona's world instead of the controller's.
      const today = new Date().getDay();
      const dayIndex = today === 0 ? 6 : today - 1;
      const res = await base44.functions.invoke('getDashboardData', { day_index: dayIndex });
      const d = res.data || {};
      if (!d.ok) throw new Error(d.error || 'Failed to load dashboard');

      setStats({
        myClasses: d.classes || [],
        todaySchedule: d.schedule || [],
        recentPoints: d.points || [],
        totalStudents: d.total_students || 0
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  // A teacher without a school membership gets a clear joining path —
  // never an all-zero dashboard that looks broken.
  if (!userProfile?.school_id) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Set up your teaching workspace"
          description="Join a school to start teaching with BlockWard"
        />
        <EmptyState
          icon={Building2}
          title="You have not joined a school yet"
          description="Your dashboard fills in as soon as you're part of a school. Join with the staff code from your school administrator, or ask them to invite you by email."
        >
          <Button asChild>
            <Link to={createPageUrl('JoinSchool')}>Join a school</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${userProfile?.first_name || 'Teacher'}'s Dashboard`}
        description="Your teaching overview"
      >
        <Button variant="outline" asChild>
          <Link to={createPageUrl('PendingSignoffs')}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Pending Sign-offs
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={createPageUrl('IssuePoints')}>
            <Award className="h-4 w-4 mr-2" />
            Issue Points
          </Link>
        </Button>
        {userProfile?.can_issue_blockwards && (
          <Button asChild>
            <Link to={createPageUrl('IssueBlockWard')}>
              <PenLine className="h-4 w-4 mr-2" />
              Create Achievement
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Pending sign-off queue — first block, clearable without leaving the dashboard */}
      <SignoffQueueWidget />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Classes" value={stats.myClasses.length} icon={BookOpen} />
        <StatCard label="Total Students" value={stats.totalStudents} icon={Users} />
        <StatCard label="Today's Lessons" value={stats.todaySchedule.length} icon={Calendar} />
        <StatCard label="Points Issued" value={stats.recentPoints.length} icon={Award} />
      </div>

      {/* Today's register status — one-click launch straight from the dashboard */}
      <TeacherRegisterStatusWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Today's Schedule</CardTitle>
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
                    <Badge variant="outline">{entry.subject}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Calendar} title="No classes scheduled today" />
            )}
          </CardContent>
        </Card>

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
              <div className="space-y-2">
                {stats.myClasses.slice(0, 4).map((cls) => (
                  <Link
                    key={cls.id}
                    to={createPageUrl(`ClassDetail?id=${cls.id}`)}
                    className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{cls.name}</p>
                      <p className="text-xs text-muted-foreground">{cls.student_emails?.length || 0} students</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={BookOpen} title="No classes yet">
                <Button variant="outline" size="sm" asChild>
                  <Link to={createPageUrl('Classes')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Class
                  </Link>
                </Button>
              </EmptyState>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Academic + Assignments + Assemblies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TeacherGradebookWidget />
        <TeacherAssignmentsWidget />
        <TeacherAssembliesWidget />
      </div>

    </div>
  );
}

export default function TeacherDashboard() {
  return (
    <ProtectedRoute>
      <TeacherDashboardContent />
    </ProtectedRoute>
  );
}
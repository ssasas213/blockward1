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
  Users, BookOpen, Award, Calendar,
  Plus, ChevronRight, PenLine
} from 'lucide-react';
import PendingSignaturesWidget from '@/components/dashboard/PendingSignaturesWidget';
import TeacherGradebookWidget from '@/components/dashboard/TeacherGradebookWidget';
import TeacherAssignmentsWidget from '@/components/dashboard/TeacherAssignmentsWidget';
import TeacherAssembliesWidget from '@/components/dashboard/TeacherAssembliesWidget';

function TeacherDashboardContent() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
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
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (!currentUser) return;

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      if (profiles.length > 0) setUserProfile(profiles[0]);

      const classes = await base44.entities.Class.filter({ teacher_email: currentUser.email });

      const today = new Date().getDay();
      const dayIndex = today === 0 ? 6 : today - 1;
      const schedule = await base44.entities.TimetableEntry.filter({
        teacher_email: currentUser.email,
        day_of_week: dayIndex
      });

      const points = await base44.entities.PointEntry.filter({ teacher_email: currentUser.email }, '-created_date', 5);

      let totalStudents = 0;
      classes.forEach(c => {
        totalStudents += (c.student_emails?.length || 0);
      });

      setStats({
        myClasses: classes,
        todaySchedule: schedule.sort((a, b) => a.start_time.localeCompare(b.start_time)),
        recentPoints: points,
        totalStudents
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
        title={`${userProfile?.first_name || 'Teacher'}'s Dashboard`}
        description="Your teaching overview"
      >
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Classes" value={stats.myClasses.length} icon={BookOpen} />
        <StatCard label="Total Students" value={stats.totalStudents} icon={Users} />
        <StatCard label="Today's Lessons" value={stats.todaySchedule.length} icon={Calendar} />
        <StatCard label="Points Issued" value={stats.recentPoints.length} icon={Award} />
      </div>

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

      {/* Pending Signatures Widget */}
      <PendingSignaturesWidget
        userEmail={user?.email}
        schoolId={userProfile?.school_id}
        role="teacher"
        targetPage="TeacherRecords"
      />
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
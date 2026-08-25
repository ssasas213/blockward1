import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const TOOLTIP_STYLE = {
  background: 'hsl(252 21% 10%)',
  border: '1px solid hsl(0 0% 100% / 0.1)',
  borderRadius: '0.5rem',
  color: 'hsl(0 0% 95%)',
};

const AXIS_TICK = { fontSize: 12, fill: 'hsl(240 8% 62%)' };

import RoleGuard from '@/components/auth/RoleGuard';
export default function Analytics() { return <RoleGuard roles={['admin']}><AnalyticsImpl/></RoleGuard>; }
function AnalyticsImpl() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pointsOverTime: [],
    topStudents: [],
    classPerformance: [],
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [students, points, classes] = await Promise.all([
        base44.entities.UserProfile.filter({ user_type: 'student' }),
        base44.entities.PointEntry.list('-created_date', 200),
        base44.entities.Class.list()
      ]);

      const now = new Date();
      const pointsOverTime = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        const weekEnd = new Date(now.getTime() - ((i - 1) * 7 * 24 * 60 * 60 * 1000));
        const weekPoints = points.filter(p => {
          const date = new Date(p.created_date);
          return date >= weekStart && date < weekEnd;
        });
        pointsOverTime.push({
          week: `Week ${4 - i}`,
          achievement: weekPoints.filter(p => p.type === 'achievement').reduce((sum, p) => sum + p.points, 0),
          behaviour: weekPoints.filter(p => p.type === 'behaviour').reduce((sum, p) => sum + Math.abs(p.points), 0)
        });
      }

      const topStudents = students
        .sort((a, b) => (b.total_achievement_points || 0) - (a.total_achievement_points || 0))
        .slice(0, 10)
        .map(s => ({
          name: `${s.first_name} ${s.last_name}`,
          points: s.total_achievement_points || 0
        }));

      const classPerformance = classes.map(cls => {
        const classStudents = students.filter(s => cls.student_emails?.includes(s.user_email));
        const avgPoints = classStudents.length > 0
          ? classStudents.reduce((sum, s) => sum + (s.total_achievement_points || 0), 0) / classStudents.length
          : 0;
        return {
          name: cls.name,
          avg: Math.round(avgPoints),
          students: classStudents.length
        };
      }).sort((a, b) => b.avg - a.avg).slice(0, 5);

      setStats({
        pointsOverTime,
        topStudents,
        classPerformance,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics Dashboard" description="Comprehensive insights and performance metrics" />
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics Dashboard" description="Comprehensive insights and performance metrics" />

      <Tabs defaultValue="points" className="space-y-6">
        <TabsList>
          <TabsTrigger value="points">Points Tracking</TabsTrigger>
          <TabsTrigger value="performance">Class Performance</TabsTrigger>
          <TabsTrigger value="top">Top Performers</TabsTrigger>
        </TabsList>

        <TabsContent value="points">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Points Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.pointsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.08)" />
                    <XAxis dataKey="week" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="achievement" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="behaviour" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Average Class Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.classPerformance.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.classPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.08)" />
                      <XAxis dataKey="name" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="avg" fill="hsl(258 90% 66%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="No class data available" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top 10 Students by Achievement Points</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topStudents.length > 0 ? (
                <div className="space-y-3">
                  {stats.topStudents.map((student, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center font-bold text-sm">
                          {i + 1}
                        </div>
                        <span className="font-medium text-foreground">{student.name}</span>
                      </div>
                      <span className="text-lg font-bold text-primary">{student.points}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No student data available" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
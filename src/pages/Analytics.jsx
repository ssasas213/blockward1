import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, Award, Activity } from 'lucide-react';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    userGrowth: [],
    pointsOverTime: [],
    topStudents: [],
    classPerformance: [],
    attendanceRate: []
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [students, teachers, points, classes] = await Promise.all([
        base44.entities.UserProfile.filter({ user_type: 'student' }),
        base44.entities.UserProfile.filter({ user_type: 'teacher' }),
        base44.entities.PointEntry.list('-created_date', 200),
        base44.entities.Class.list()
      ]);

      // Calculate points over time (last 4 weeks)
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

      // Top students
      const topStudents = students
        .sort((a, b) => (b.total_achievement_points || 0) - (a.total_achievement_points || 0))
        .slice(0, 10)
        .map(s => ({
          name: `${s.first_name} ${s.last_name}`,
          points: s.total_achievement_points || 0
        }));

      // Class performance (based on enrolled students' average points)
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
        userGrowth: [],
        pointsOverTime,
        topStudents,
        classPerformance,
        attendanceRate: 0
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
        <p className="text-slate-500 mt-1">Comprehensive insights and performance metrics</p>
      </div>



      <Tabs defaultValue="points" className="space-y-6">
        <TabsList>
          <TabsTrigger value="points">Points Tracking</TabsTrigger>
          <TabsTrigger value="performance">Class Performance</TabsTrigger>
          <TabsTrigger value="top">Top Performers</TabsTrigger>
        </TabsList>

        <TabsContent value="points">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Points Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.pointsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="achievement" fill="#10B981" />
                    <Bar dataKey="behaviour" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Average Class Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.classPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avg" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Top 10 Students by Achievement Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topStudents.map((student, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center font-bold">
                        #{i + 1}
                      </div>
                      <span className="font-medium text-slate-900">{student.name}</span>
                    </div>
                    <span className="text-lg font-bold text-violet-600">{student.points}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}